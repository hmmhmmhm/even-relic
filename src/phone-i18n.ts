import {
  LOCALE_REGISTRY,
  SUPPORTED_LOCALES,
  resolveLocale,
} from "./i18n/locale-registry";
import type { enLocale } from "./i18n/locales/en";
import type { PhoneLocale, PhoneLocaleSetting } from "./phone-types";
import {
  translateAiPhone,
  type AiPhoneStringKey,
} from "./ai-i18n";
import {
  isMcpPhoneStringKey,
  translateMcpPhone,
  type McpPhoneStringKey,
} from "./mcp-i18n";

type CorePhoneStringKey = keyof typeof enLocale.phone;
export type PhoneStringKey = CorePhoneStringKey | AiPhoneStringKey
  | McpPhoneStringKey;

export const PHONE_STRINGS = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale,
    LOCALE_REGISTRY[locale].phone,
  ]),
) as {
  readonly [Locale in PhoneLocale]: Readonly<
    Record<CorePhoneStringKey, string>
  >;
};

export function resolvePhoneLocale(
  setting: PhoneLocaleSetting,
  browserLanguage: string,
): PhoneLocale {
  return resolveLocale(setting, browserLanguage);
}

export function translatePhone(
  locale: PhoneLocale,
  key: PhoneStringKey,
): string {
  return key in PHONE_STRINGS[locale]
    ? PHONE_STRINGS[locale][key as CorePhoneStringKey]
    : isMcpPhoneStringKey(key)
      ? translateMcpPhone(locale, key)
      : translateAiPhone(locale, key as AiPhoneStringKey);
}
