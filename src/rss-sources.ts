import { readCache, writeCache, type EvenStorage } from "./live-cache";

export type RssSource = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly isDefault: boolean;
};

export const DEFAULT_RSS_SOURCE: RssSource = {
  id: "sbs-latest",
  name: "SBS Latest",
  url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01",
  enabled: true,
  isDefault: true,
};

const SOURCE_LIMIT = 6;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

type UrlValidation =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly code: "invalid" | "unsafe" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSource(value: unknown): value is RssSource {
  return isRecord(value)
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.name === "string"
    && value.name.trim() === value.name
    && value.name.length > 0
    && typeof value.url === "string"
    && validateRssSourceUrl(value.url).ok
    && typeof value.enabled === "boolean"
    && typeof value.isDefault === "boolean";
}

function isSourceList(value: unknown): value is readonly RssSource[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= SOURCE_LIMIT
    && value.every(isSource)
    && value.filter((source) => source.isDefault).length === 1
    && value.some((source) => source.id === DEFAULT_RSS_SOURCE.id)
    && new Set(value.map((source) => source.id)).size === value.length;
}

function cloneSources(value: readonly RssSource[]): readonly RssSource[] {
  return value.map((source) => ({ ...source }));
}

export function validateRssSourceUrl(value: string): UrlValidation {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.hash
      || (url.port && url.port !== "443")
      || hostname === "localhost"
      || hostname.endsWith(".localhost")
      || hostname.endsWith(".local")
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
      || hostname.includes(":")
    ) {
      return { ok: false, code: "unsafe" };
    }
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, code: "invalid" };
  }
}

function normalizeName(value: string): string {
  return [...value.trim().replace(/\s+/g, " ")]
    .slice(0, 40)
    .join("");
}

function sourceId(name: string, url: string): string {
  let hash = 0x811c9dc5;
  for (const character of `${name}\0${url}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `feed-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function addRssSource(
  sources: readonly RssSource[],
  name: string,
  urlValue: string,
): readonly RssSource[] {
  if (sources.length >= SOURCE_LIMIT) throw new Error("rss_source_limit");
  const normalizedName = normalizeName(name);
  if (!normalizedName || CONTROL_CHARACTERS.test(normalizedName)) {
    throw new Error("rss_source_name");
  }
  const validation = validateRssSourceUrl(urlValue);
  if (!validation.ok) throw new Error("rss_source_url");
  if (sources.some((source) => source.url === validation.value)) {
    throw new Error("rss_source_duplicate");
  }
  return [
    ...cloneSources(sources),
    {
      id: sourceId(normalizedName, validation.value),
      name: normalizedName,
      url: validation.value,
      enabled: true,
      isDefault: false,
    },
  ];
}

export function deleteRssSource(
  sources: readonly RssSource[],
  id: string,
): readonly RssSource[] {
  if (id === DEFAULT_RSS_SOURCE.id) return sources;
  return sources.filter((source) => source.id !== id);
}

export function updateRssSource(
  sources: readonly RssSource[],
  id: string,
  change: Partial<Pick<RssSource, "name" | "enabled">>,
): readonly RssSource[] {
  return sources.map((source) => {
    if (source.id !== id) return source;
    const name = change.name === undefined
      ? source.name
      : normalizeName(change.name);
    if (!name || CONTROL_CHARACTERS.test(name)) {
      throw new Error("rss_source_name");
    }
    return {
      ...source,
      name,
      enabled: change.enabled ?? source.enabled,
    };
  });
}

export async function resolveRssSources(
  storage: EvenStorage,
): Promise<readonly RssSource[]> {
  const cached = await readCache(storage, "rss-sources", isSourceList);
  return cloneSources(cached ?? [DEFAULT_RSS_SOURCE]);
}

export function writeRssSources(
  storage: EvenStorage,
  sources: readonly RssSource[],
): Promise<boolean> {
  if (!isSourceList(sources)) return Promise.resolve(false);
  return writeCache(storage, "rss-sources", cloneSources(sources));
}
