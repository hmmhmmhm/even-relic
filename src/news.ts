import { readCache, writeCache, type EvenStorage } from "./live-cache";
import type { DataState, NewsItem } from "./live-state";

export const NEWS_MAX_AGE_MS = 10 * 60 * 1000;
const NEWS_TIMEOUT_MS = 8_000;
const NEWS_URL = "/api/news?feed=sbs-latest";
const NEWS_LIMIT = 6;

type NewsCache = {
  readonly value: readonly NewsItem[];
  readonly fetchedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isNewsItem(value: unknown): value is NewsItem {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string"
    || value.id.length === 0
    || typeof value.title !== "string"
    || value.title.length === 0
  ) {
    return false;
  }
  if (
    value.url !== undefined
    && (typeof value.url !== "string" || !isHttpUrl(value.url))
  ) {
    return false;
  }
  return value.publishedAt === undefined
    || (typeof value.publishedAt === "number"
      && Number.isFinite(value.publishedAt));
}

function isNewsCache(value: unknown): value is NewsCache {
  return isRecord(value)
    && typeof value.fetchedAt === "number"
    && Number.isFinite(value.fetchedAt)
    && Array.isArray(value.value)
    && value.value.length > 0
    && value.value.length <= NEWS_LIMIT
    && value.value.every(isNewsItem);
}

function sanitizeText(value: string): string {
  const document = new DOMParser().parseFromString(value, "text/html");
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function childText(item: Element, selector: string): string {
  return item.querySelector(selector)?.textContent ?? "";
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeUrl(value: string): string | undefined {
  const normalized = sanitizeText(value);
  return normalized && isHttpUrl(normalized) ? normalized : undefined;
}

function cloneItems(items: readonly NewsItem[]): readonly NewsItem[] {
  return items.map((item) => ({ ...item }));
}

export function parseNewsRss(xml: string): readonly NewsItem[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (
    document.querySelector("parsererror")
    || document.documentElement.localName !== "rss"
  ) {
    return [];
  }

  const records: Array<NewsItem & { readonly sourceIndex: number }> = [];
  const seen = new Set<string>();
  for (const [sourceIndex, item] of [
    ...document.querySelectorAll("item"),
  ].entries()) {
    const title = sanitizeText(childText(item, "title"));
    if (!title) continue;
    const guid = sanitizeText(childText(item, "guid"));
    const url = normalizeUrl(childText(item, "link"));
    const id = guid
      ? `guid:${guid}`
      : url
        ? `link:${url}`
        : `title:${fnv1a(title)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const parsedDate = Date.parse(sanitizeText(childText(item, "pubDate")));
    records.push({
      id,
      title,
      ...(url ? { url } : {}),
      ...(Number.isFinite(parsedDate) ? { publishedAt: parsedDate } : {}),
      sourceIndex,
    });
  }

  records.sort((left, right) => {
    const leftHasDate = left.publishedAt !== undefined;
    const rightHasDate = right.publishedAt !== undefined;
    if (leftHasDate && rightHasDate) {
      const dateOrder = right.publishedAt! - left.publishedAt!;
      return dateOrder || left.sourceIndex - right.sourceIndex;
    }
    if (leftHasDate !== rightHasDate) return leftHasDate ? -1 : 1;
    return left.sourceIndex - right.sourceIndex;
  });

  return records.slice(0, NEWS_LIMIT).map(({ sourceIndex: _, ...item }) => item);
}

function toState(
  cache: NewsCache,
  status: "fresh" | "stale",
): DataState<readonly NewsItem[]> {
  return {
    status,
    value: cloneItems(cache.value),
    fetchedAt: cache.fetchedAt,
  };
}

export async function resolveNews(
  storage: EvenStorage,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
  onCached?: (cached: DataState<readonly NewsItem[]>) => void,
): Promise<DataState<readonly NewsItem[]>> {
  const cached = await readCache(storage, "news", isNewsCache);
  const usableCache = cached && cached.fetchedAt <= now ? cached : undefined;
  if (usableCache) {
    const status = now - usableCache.fetchedAt <= NEWS_MAX_AGE_MS
      ? "fresh"
      : "stale";
    const cachedState = toState(usableCache, status);
    onCached?.(cachedState);
    if (status === "fresh") return cachedState;
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    NEWS_TIMEOUT_MS,
  );
  try {
    const response = await fetchImpl(NEWS_URL, {
      headers: {
        accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("NEWS_HTTP_ERROR");
    const items = parseNewsRss(await response.text());
    if (items.length === 0) throw new Error("NEWS_EMPTY");

    const value = cloneItems(items);
    const cache: NewsCache = { value, fetchedAt: now };
    await writeCache(storage, "news", cache);
    return {
      status: "fresh",
      value: cloneItems(value),
      fetchedAt: now,
    };
  } catch {
    return usableCache
      ? toState(usableCache, "stale")
      : { status: "unavailable" };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
