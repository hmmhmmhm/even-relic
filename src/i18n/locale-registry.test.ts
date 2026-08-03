import { describe, expect, it } from "vitest";
import {
  LOCALE_OPTIONS,
  LOCALE_REGISTRY,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  resolveLocale,
} from "./locale-registry";

const ORIGINAL_LOCALES = [
  "ko", "en", "ja", "zh-Hans", "zh-Hant", "es", "fr", "de", "it", "pt",
  "nl", "pl", "ru", "uk", "tr", "ar", "he", "hi", "bn", "id", "vi", "th",
  "ms", "fil", "sv", "no", "da", "fi", "cs", "ro",
] as const;

function messagePaths(
  value: unknown,
  prefix = "",
): readonly string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => (
      messagePaths(item, `${prefix}[${index}]`)
    ));
  }
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, item]) => (
    messagePaths(item, prefix ? `${prefix}.${key}` : key)
  ));
}

function translatedMessages(
  pack: (typeof LOCALE_REGISTRY)[keyof typeof LOCALE_REGISTRY],
) {
  const {
    code: _code,
    nativeName: _nativeName,
    browserTags: _browserTags,
    direction: _direction,
    ...messages
  } = pack;
  return messages;
}

describe("locale registry", () => {
  it("derives supported locales and native language options", () => {
    expect(SUPPORTED_LOCALES.slice(0, ORIGINAL_LOCALES.length))
      .toEqual(ORIGINAL_LOCALES);
    expect(new Set(SUPPORTED_LOCALES)).toHaveLength(180);
    expect(LOCALE_OPTIONS).toHaveLength(180);
    for (const locale of SUPPORTED_LOCALES) {
      expect(["ltr", "rtl"]).toContain(LOCALE_REGISTRY[locale].direction);
    }
    expect(isSupportedLocale("ko")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("ja")).toBe(true);
  });

  it("resolves exact, normalized, base, explicit, and fallback locales", () => {
    expect(resolveLocale("system", "ko-KR")).toBe("ko");
    expect(resolveLocale("system", "en_US")).toBe("en");
    expect(resolveLocale("system", "KO_kr")).toBe("ko");
    expect(resolveLocale("system", "ja-JP")).toBe("ja");
    expect(resolveLocale("system", "zh_TW")).toBe("zh-Hant");
    expect(resolveLocale("system", "zh-CN")).toBe("zh-Hans");
    expect(resolveLocale("system", "pt_BR")).toBe("pt");
    expect(resolveLocale("system", "iw-IL")).toBe("he");
    expect(resolveLocale("system", "in-ID")).toBe("id");
    expect(resolveLocale("system", "tl-PH")).toBe("fil");
    expect(resolveLocale("system", "nb-NO")).toBe("no");
    expect(resolveLocale("ko", "en-US")).toBe("ko");
  });

  it("keeps every locale pack structurally complete", () => {
    const englishPaths = messagePaths(translatedMessages(LOCALE_REGISTRY.en));
    for (const locale of SUPPORTED_LOCALES) {
      const pack = LOCALE_REGISTRY[locale];
      expect(pack.code).toBe(locale);
      expect(pack.weekdays).toHaveLength(7);
      expect(messagePaths(translatedMessages(pack))).toEqual(englishPaths);
    }
  });
});
