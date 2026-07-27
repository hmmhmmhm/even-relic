import {
  createTimeout,
  jsonResponse,
  readLimitedBytes,
} from "./http.js";

const FEEDS = new Map([
  [
    "sbs-latest",
    "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER",
  ],
]);
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;

function newsError(code, message, status) {
  return jsonResponse({ error: { code, message } }, { status });
}

export async function handleNewsRequest(
  request,
  _env,
  {
    fetchImpl = fetch,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  const feed = FEEDS.get(new URL(request.url).searchParams.get("feed"));
  if (!feed) {
    return newsError(
      "UNSUPPORTED_FEED",
      "Unsupported news feed",
      400,
    );
  }

  const timeout = createTimeout(
    TIMEOUT_MS,
    setTimeoutImpl,
    clearTimeoutImpl,
  );
  try {
    const upstream = await fetchImpl(feed, {
      redirect: "error",
      headers: {
        accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: timeout.signal,
    });
    if (!upstream.ok) {
      return newsError(
        "NEWS_UPSTREAM_ERROR",
        "News upstream request failed",
        502,
      );
    }

    const bytes = await readLimitedBytes(upstream, MAX_BYTES);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (timeout.signal.aborted || error?.name === "AbortError") {
      return newsError("NEWS_TIMEOUT", "News request timed out", 504);
    }
    if (error instanceof Error && error.message === "RESPONSE_TOO_LARGE") {
      return newsError("NEWS_TOO_LARGE", "News response is too large", 502);
    }
    return newsError(
      "NEWS_UPSTREAM_ERROR",
      "News upstream request failed",
      502,
    );
  } finally {
    timeout.dispose();
  }
}
