import { arLocale } from "./locales/ar";
import { bnLocale } from "./locales/bn";
import { csLocale } from "./locales/cs";
import { daLocale } from "./locales/da";
import { deLocale } from "./locales/de";
import { enLocale } from "./locales/en";
import { esLocale } from "./locales/es";
import { fiLocale } from "./locales/fi";
import { filLocale } from "./locales/fil";
import { frLocale } from "./locales/fr";
import { heLocale } from "./locales/he";
import { hiLocale } from "./locales/hi";
import { idLocale } from "./locales/id";
import { itLocale } from "./locales/it";
import { jaLocale } from "./locales/ja";
import { koLocale } from "./locales/ko";
import { msLocale } from "./locales/ms";
import { nlLocale } from "./locales/nl";
import { noLocale } from "./locales/no";
import { plLocale } from "./locales/pl";
import { ptLocale } from "./locales/pt";
import { roLocale } from "./locales/ro";
import { ruLocale } from "./locales/ru";
import { svLocale } from "./locales/sv";
import { thLocale } from "./locales/th";
import { trLocale } from "./locales/tr";
import { ukLocale } from "./locales/uk";
import { viLocale } from "./locales/vi";
import { zhHansLocale } from "./locales/zh-Hans";
import { zhHantLocale } from "./locales/zh-Hant";

export const LOCALE_REGISTRY = {
  ko: koLocale,
  en: enLocale,
  ja: jaLocale,
  "zh-Hans": zhHansLocale,
  "zh-Hant": zhHantLocale,
  es: esLocale,
  fr: frLocale,
  de: deLocale,
  it: itLocale,
  pt: ptLocale,
  nl: nlLocale,
  pl: plLocale,
  ru: ruLocale,
  uk: ukLocale,
  tr: trLocale,
  ar: arLocale,
  he: heLocale,
  hi: hiLocale,
  bn: bnLocale,
  id: idLocale,
  vi: viLocale,
  th: thLocale,
  ms: msLocale,
  fil: filLocale,
  sv: svLocale,
  no: noLocale,
  da: daLocale,
  fi: fiLocale,
  cs: csLocale,
  ro: roLocale,
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
