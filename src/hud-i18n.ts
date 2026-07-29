import { LOCALE_REGISTRY } from "./i18n/locale-registry";
import type { enLocale } from "./i18n/locales/en";
import type { PhoneLocale } from "./phone-types";

export type HudStringKey = keyof typeof enLocale.hud;

export function translateHud(
  locale: PhoneLocale,
  key: HudStringKey,
): string {
  return LOCALE_REGISTRY[locale].hud[key];
}

export function hudWeekday(locale: PhoneLocale, day: number): string {
  return LOCALE_REGISTRY[locale].weekdays[day] ?? "";
}
