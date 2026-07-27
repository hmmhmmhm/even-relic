import assert from "node:assert/strict";
import test from "node:test";
import { handleApiRequest } from "../server/api-router.js";
import { handleNewsRequest } from "../server/news.js";

const FEED_URL =
  "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER";

function rssResponse(body = "<rss><channel /></rss>", init = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/rss+xml" },
    ...init,
  });
}

test("proxies only the fixed SBS latest feed with hardened options", async () => {
  const calls = [];
  const response = await handleApiRequest(
    new Request("https://example.test/api/news?feed=sbs-latest"),
    {},
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return rssResponse("<rss>ok</rss>");
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<rss>ok</rss>");
  assert.equal(
    response.headers.get("content-type"),
    "application/rss+xml; charset=utf-8",
  );
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, FEED_URL);
  assert.equal(calls[0].options.redirect, "error");
  assert.deepEqual(calls[0].options.headers, {
    accept: "application/rss+xml, application/xml, text/xml",
  });
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test("rejects unsupported feeds without calling upstream", async () => {
  let calls = 0;
  const response = await handleNewsRequest(
    new Request("https://example.test/api/news?feed=unknown"),
    {},
    { fetchImpl: async () => {
      calls += 1;
      return rssResponse();
    } },
  );

  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), {
    error: {
      code: "UNSUPPORTED_FEED",
      message: "Unsupported news feed",
    },
  });
});

test("leaves non-GET news requests to the API 404", async () => {
  let calls = 0;
  const response = await handleApiRequest(
    new Request("https://example.test/api/news?feed=sbs-latest", {
      method: "POST",
    }),
    {},
    { fetchImpl: async () => {
      calls += 1;
      return rssResponse();
    } },
  );

  assert.equal(response.status, 404);
  assert.equal(calls, 0);
  assert.equal((await response.json()).error.code, "API_NOT_FOUND");
});

test("maps an upstream non-2xx response to a stable JSON error", async () => {
  const response = await handleNewsRequest(
    new Request("https://example.test/api/news?feed=sbs-latest"),
    {},
    { fetchImpl: async () => new Response("bad", { status: 503 }) },
  );

  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "NEWS_UPSTREAM_ERROR");
});

test("cancels and rejects a response larger than one million bytes", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600_000));
      controller.enqueue(new Uint8Array(600_000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = await handleNewsRequest(
    new Request("https://example.test/api/news?feed=sbs-latest"),
    {},
    {
      fetchImpl: async () => new Response(body, { status: 200 }),
    },
  );

  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "NEWS_TOO_LARGE");
  assert.equal(cancelled, true);
});

test("maps the eight-second abort to NEWS_TIMEOUT and clears its timer", async () => {
  const cleared = [];
  const response = await handleNewsRequest(
    new Request("https://example.test/api/news?feed=sbs-latest"),
    {},
    {
      setTimeoutImpl: (callback, milliseconds) => {
        assert.equal(milliseconds, 8_000);
        callback();
        return 42;
      },
      clearTimeoutImpl: (timer) => cleared.push(timer),
      fetchImpl: async (_url, { signal }) => {
        assert.equal(signal.aborted, true);
        throw new DOMException("Aborted", "AbortError");
      },
    },
  );

  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "NEWS_TIMEOUT");
  assert.deepEqual(cleared, [42]);
});
