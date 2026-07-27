// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "./live-cache";
import type { NewsItem } from "./live-state";
import {
  NEWS_MAX_AGE_MS,
  parseNewsRss,
  resolveNews,
} from "./news";

const NOW = Date.parse("2026-07-27T06:00:00Z");
const ITEMS: readonly NewsItem[] = [
  {
    id: "guid:new",
    title: "첫 번째 최신 기사",
    url: "https://news.sbs.co.kr/a",
    publishedAt: Date.parse("2026-07-27T05:00:00Z"),
  },
];

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[<b>첫 번째</b> 최신 기사]]></title>
    <guid>new</guid>
    <link>https://news.sbs.co.kr/a</link>
    <pubDate>Mon, 27 Jul 2026 05:00:00 GMT</pubDate>
  </item>
  <item>
    <title>중복된 이전 기사</title>
    <guid>new</guid>
    <pubDate>Mon, 27 Jul 2026 04:00:00 GMT</pubDate>
  </item>
  <item>
    <title>두 번째 &amp; 주요 기사</title>
    <guid>two</guid>
    <pubDate>Mon, 27 Jul 2026 04:30:00 GMT</pubDate>
  </item>
  <item><title>세 번째 기사</title><link>https://news.sbs.co.kr/c</link></item>
  <item><title>네 번째 기사</title></item>
  <item><title>다섯 번째 기사</title><guid>five</guid></item>
  <item><title>여섯 번째 기사</title><guid>six</guid></item>
  <item><title>일곱 번째 제외 기사</title><guid>seven</guid></item>
</channel></rss>`;

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];

  constructor(
    private readonly mode: "working" | "read-fails" | "write-fails" =
      "working",
  ) {}

  async getLocalStorage(key: string): Promise<string> {
    if (this.mode === "read-fails") throw new Error("read failed");
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    if (this.mode === "write-fails") throw new Error("write failed");
    this.values.set(key, value);
    return true;
  }
}

function xmlFetch(
  xml: string,
  options: { ok?: boolean; rejects?: boolean } = {},
): typeof fetch {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (options.rejects) throw new Error("network failed");
    return {
      ok: options.ok ?? true,
      text: async () => xml,
      signal: init?.signal,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function setCache(
  storage: TestStorage,
  value: readonly NewsItem[],
  fetchedAt: number,
) {
  storage.values.set(
    "relic:news:v1",
    JSON.stringify({ value, fetchedAt }),
  );
}

afterEach(() => vi.useRealTimers());

describe("parseNewsRss", () => {
  it("sanitizes, deduplicates, sorts, and limits headlines to six", () => {
    const items = parseNewsRss(RSS);

    expect(items[0]).toEqual(ITEMS[0]);
    expect(items).toHaveLength(6);
    expect(items.map(({ title }) => title)).toEqual([
      "첫 번째 최신 기사",
      "두 번째 & 주요 기사",
      "세 번째 기사",
      "네 번째 기사",
      "다섯 번째 기사",
      "여섯 번째 기사",
    ]);
    expect(items.every(({ title }) => !/[<>]/.test(title))).toBe(true);
  });

  it("returns an empty list for malformed XML or no usable titles", () => {
    expect(parseNewsRss("<not-rss>")).toEqual([]);
    expect(parseNewsRss("<rss><channel><item><title> </title></item></channel></rss>"))
      .toEqual([]);
  });

  it("uses link then a deterministic title hash when guid is absent", () => {
    const items = parseNewsRss(`<?xml version="1.0"?>
      <rss><channel>
        <item><title>링크 기사</title><link>https://news.sbs.co.kr/link</link></item>
        <item><title>제목 전용 기사</title></item>
      </channel></rss>`);

    expect(items[0].id).toBe("link:https://news.sbs.co.kr/link");
    expect(items[1].id).toMatch(/^title:[0-9a-f]{8}$/);
  });
});

describe("resolveNews", () => {
  it("returns a fresh cache immediately without fetching", async () => {
    const storage = new TestStorage();
    setCache(storage, ITEMS, NOW - NEWS_MAX_AGE_MS);
    const fetchImpl = vi.fn();
    const cached = vi.fn();

    const result = await resolveNews(
      storage,
      fetchImpl as typeof fetch,
      NOW,
      cached,
    );

    expect(result).toEqual({
      status: "fresh",
      value: ITEMS,
      fetchedAt: NOW - NEWS_MAX_AGE_MS,
    });
    expect(cached).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shows stale cache before refreshing it", async () => {
    const storage = new TestStorage();
    setCache(storage, [{ ...ITEMS[0], title: "이전 기사" }], NOW - NEWS_MAX_AGE_MS - 1);
    const order: string[] = [];
    const fetchImpl = vi.fn(async () => {
      order.push("fetch");
      return { ok: true, text: async () => RSS } as Response;
    }) as unknown as typeof fetch;

    const result = await resolveNews(
      storage,
      fetchImpl,
      NOW,
      (cached) => {
        order.push("cache");
        expect(cached.status).toBe("stale");
      },
    );

    expect(order).toEqual(["cache", "fetch"]);
    expect(result.status).toBe("fresh");
    expect(result.value?.[0].title).toBe("첫 번째 최신 기사");
  });

  it("keeps stale headlines on refresh failure", async () => {
    const storage = new TestStorage();
    setCache(storage, ITEMS, NOW - NEWS_MAX_AGE_MS - 1);

    await expect(
      resolveNews(storage, xmlFetch("", { rejects: true }), NOW),
    ).resolves.toEqual({
      status: "stale",
      value: ITEMS,
      fetchedAt: NOW - NEWS_MAX_AGE_MS - 1,
    });
  });

  it("returns unavailable when no cache and refresh fails or parses empty", async () => {
    const storage = new TestStorage();

    await expect(
      resolveNews(storage, xmlFetch("", { rejects: true }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      resolveNews(storage, xmlFetch("<rss><channel /></rss>"), NOW),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("ignores corrupt and future caches", async () => {
    const corrupt = new TestStorage();
    corrupt.values.set("relic:news:v1", "{bad");
    const future = new TestStorage();
    setCache(future, ITEMS, NOW + 1);

    await expect(
      resolveNews(corrupt, xmlFetch("", { ok: false }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      resolveNews(future, xmlFetch("", { ok: false }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("persists six normalized items and survives storage failures", async () => {
    const storage = new TestStorage();
    const writeFailure = new TestStorage("write-fails");
    const readFailure = new TestStorage("read-fails");

    const result = await resolveNews(storage, xmlFetch(RSS), NOW);
    expect(storage.writes).toEqual([[
      "relic:news:v1",
      JSON.stringify({ value: result.value, fetchedAt: NOW }),
    ]]);
    await expect(resolveNews(writeFailure, xmlFetch(RSS), NOW))
      .resolves.toMatchObject({ status: "fresh" });
    await expect(resolveNews(readFailure, xmlFetch("", { ok: false }), NOW))
      .resolves.toEqual({ status: "unavailable" });
  });

  it("aborts after eight seconds and clears the timer", async () => {
    vi.useFakeTimers();
    const storage = new TestStorage();
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;

    const pending = resolveNews(storage, fetchImpl, NOW);
    await vi.advanceTimersByTimeAsync(8_000);

    await expect(pending).resolves.toEqual({ status: "unavailable" });
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
