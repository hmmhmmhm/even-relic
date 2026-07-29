import { describe, expect, it } from "vitest";
import {
  LOCALE_OPTIONS,
  LOCALE_REGISTRY,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  resolveLocale,
} from "./locale-registry";

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

describe("locale registry", () => {
  it("derives supported locales and native language options", () => {
    expect(SUPPORTED_LOCALES).toEqual(["ko", "en"]);
    expect(LOCALE_OPTIONS).toEqual([
      { value: "ko", label: "한국어" },
      { value: "en", label: "English" },
    ]);
    expect(isSupportedLocale("ko")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("ja")).toBe(false);
  });

  it("resolves exact, normalized, base, explicit, and fallback locales", () => {
    expect(resolveLocale("system", "ko-KR")).toBe("ko");
    expect(resolveLocale("system", "en_US")).toBe("en");
    expect(resolveLocale("system", "KO_kr")).toBe("ko");
    expect(resolveLocale("system", "ja-JP")).toBe("en");
    expect(resolveLocale("ko", "en-US")).toBe("ko");
  });

  it("keeps every locale pack structurally complete", () => {
    const englishPaths = messagePaths(LOCALE_REGISTRY.en);
    for (const locale of SUPPORTED_LOCALES) {
      const pack = LOCALE_REGISTRY[locale];
      expect(pack.code).toBe(locale);
      expect(pack.weekdays).toHaveLength(7);
      expect(messagePaths(pack)).toEqual(englishPaths);
    }
  });
});
