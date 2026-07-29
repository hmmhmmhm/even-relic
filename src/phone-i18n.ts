import {
  LOCALE_REGISTRY,
  SUPPORTED_LOCALES,
  resolveLocale,
} from "./i18n/locale-registry";
import type { enLocale } from "./i18n/locales/en";
import type { PhoneLocale, PhoneLocaleSetting } from "./phone-types";

export type PhoneStringKey = keyof typeof enLocale.phone;

export const PHONE_STRINGS = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale,
    LOCALE_REGISTRY[locale].phone,
  ]),
) as {
  readonly [Locale in PhoneLocale]: Readonly<
    Record<PhoneStringKey, string>
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
  return PHONE_STRINGS[locale][key];
}
