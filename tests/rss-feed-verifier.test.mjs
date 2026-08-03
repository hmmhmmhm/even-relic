import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyAllFeeds,
  verifyFeed,
} from "../scripts/verify-rss-feeds.mjs";

const FEED = Object.freeze({
  id: "example",
  name: "Example",
  locale: "en",
  url: "https://example.com/rss.xml",
});

function response(
  body = "<rss><channel><item><title>News</title></item></channel></rss>",
  init = {},
) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/rss+xml" },
    ...init,
  });
}

test("accepts one bounded RSS response", async () => {
  const calls = [];
  const result = await verifyFeed(FEED, async (url, options) => {
    calls.push({ url, options });
    return response();
  });

  assert.equal(result.ok, true);
  assert.equal(result.feed.id, "example");
  assert.equal(result.itemCount, 1);
  assert.equal(calls[0].url, FEED.url);
  assert.equal(calls[0].options.redirect, "manual");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

for (const [name, upstream, error] of [
  ["redirect", response("", { status: 302 }), "REDIRECT"],
  ["non-200", response("", { status: 503 }), "HTTP_STATUS"],
  [
    "non-XML content type",
    response("<rss><item /></rss>", {
      headers: { "content-type": "text/html" },
    }),
    "CONTENT_TYPE",
  ],
  [
    "missing feed root",
    response("<document><item /></document>"),
    "MISSING_ROOT",
  ],
  [
    "missing item",
    response("<rss><channel /></rss>"),
    "MISSING_ITEM",
  ],
]) {
  test(`reports ${name}`, async () => {
    const result = await verifyFeed(FEED, async () => upstream);
    assert.equal(result.ok, false);
    assert.equal(result.error, error);
  });
}

test("rejects and cancels a body larger than one megabyte", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600_000));
      controller.enqueue(new Uint8Array(400_001));
    },
    cancel() {
      cancelled = true;
    },
  });
  const result = await verifyFeed(FEED, async () => response(body));

  assert.equal(result.ok, false);
  assert.equal(result.error, "TOO_LARGE");
  assert.equal(cancelled, true);
});

test("reports the eight-second timeout and clears its timer", async () => {
  const cleared = [];
  const result = await verifyFeed(
    FEED,
    async (_url, { signal }) => {
      assert.equal(signal.aborted, true);
      throw new DOMException("Aborted", "AbortError");
    },
    {
      setTimeoutImpl(callback, milliseconds) {
        assert.equal(milliseconds, 8_000);
        callback();
        return 42;
      },
      clearTimeoutImpl(timer) {
        cleared.push(timer);
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "TIMEOUT");
  assert.deepEqual(cleared, [42]);
});

test("verifies feeds sequentially and retains later results", async () => {
  let active = 0;
  let peak = 0;
  const feeds = [
    FEED,
    { ...FEED, id: "broken", url: "https://example.com/broken.xml" },
    { ...FEED, id: "last", url: "https://example.com/last.xml" },
  ];
  const results = await verifyAllFeeds(feeds, async (url) => {
    active += 1;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active -= 1;
    return url.includes("broken")
      ? response("", { status: 500 })
      : response();
  });

  assert.equal(peak, 1);
  assert.equal(results.length, 3);
  assert.deepEqual(results.map(({ ok }) => ok), [true, false, true]);
});

test("checks a shared fallback URL once and reports every locale", async () => {
  let calls = 0;
  const results = await verifyAllFeeds([
    FEED,
    { ...FEED, id: "fallback", locale: "af" },
  ], async () => {
    calls += 1;
    return response();
  });

  assert.equal(calls, 1);
  assert.deepEqual(results.map(({ feed }) => feed.id), ["example", "fallback"]);
  assert.deepEqual(results.map(({ ok }) => ok), [true, true]);
});
