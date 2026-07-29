import { enLocale } from "./locales/en";
import { koLocale } from "./locales/ko";

export const LOCALE_REGISTRY = {
  en: enLocale,
  ko: koLocale,
} as const;

export type SupportedLocale = keyof typeof LOCALE_REGISTRY;
export type LocaleSetting = "system" | SupportedLocale;

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const SUPPORTED_LOCALES = Object.freeze(
  Object.keys(LOCALE_REGISTRY) as SupportedLocale[],
);

export const LOCALE_OPTIONS = Object.freeze(
  SUPPORTED_LOCALES.map((value) => Object.freeze({
    value,
    label: LOCALE_REGISTRY[value].nativeName,
  })),
);

const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

export function isSupportedLocale(
  value: unknown,
): value is SupportedLocale {
  return typeof value === "string" && SUPPORTED_LOCALE_SET.has(value);
}

function normalizedLanguage(value: string): string {
  return value.trim().replaceAll("_", "-").toLowerCase();
}

export function resolveLocale(
  setting: LocaleSetting,
  browserLanguage: string,
): SupportedLocale {
  if (setting !== "system") return setting;
  const normalized = normalizedLanguage(browserLanguage);
  const base = normalized.split("-")[0] ?? "";

  return SUPPORTED_LOCALES.find((locale) => {
    const tags = LOCALE_REGISTRY[locale].browserTags;
    return tags.some((tag) => normalizedLanguage(tag) === normalized);
  }) ?? SUPPORTED_LOCALES.find((locale) => {
    const tags = LOCALE_REGISTRY[locale].browserTags;
    return tags.some((tag) => normalizedLanguage(tag).split("-")[0] === base);
  }) ?? DEFAULT_LOCALE;
}
