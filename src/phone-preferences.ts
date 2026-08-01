import { readCache, writeCache, type EvenStorage } from "./live-cache";
import { isSupportedLocale } from "./i18n/locale-registry";
import type {
  HudPageId,
  PhoneLocaleSetting,
  PhonePreferences,
} from "./phone-types";

const KEYLESS_PAGES = [
  "overview",
  "news",
  "todo",
  "weather",
  "ai",
] as const satisfies readonly HudPageId[];

const ALL_PAGES = [
  ...KEYLESS_PAGES,
  "navigation",
] as const satisfies readonly HudPageId[];

const PAGE_IDS = new Set<HudPageId>(ALL_PAGES);

function isLocaleSetting(value: unknown): value is PhoneLocaleSetting {
  return value === "system" || isSupportedLocale(value);
}

export const DEFAULT_PHONE_PREFERENCES: PhonePreferences = {
  locale: "system",
  order: KEYLESS_PAGES,
  enabled: KEYLESS_PAGES,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPageArray(value: unknown): value is readonly HudPageId[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === "string" && PAGE_IDS.has(item as HudPageId));
}

function isPhonePreferences(value: unknown): value is PhonePreferences {
  return isRecord(value)
    && typeof value.locale === "string"
    && isLocaleSetting(value.locale)
    && isPageArray(value.order)
    && isPageArray(value.enabled);
}

function clonePreferences(value: PhonePreferences): PhonePreferences {
  return {
    locale: value.locale,
    order: [...value.order],
    enabled: [...value.enabled],
  };
}

function isValidLayout(
  value: PhonePreferences,
  navigationAvailable: boolean,
): boolean {
  const available: readonly HudPageId[] = navigationAvailable
    ? ALL_PAGES
    : KEYLESS_PAGES;
  if (
    value.order[0] !== "overview"
    || new Set(value.order).size !== value.order.length
    || value.order.some((page) => !available.includes(page))
    || KEYLESS_PAGES.some((page) => !value.order.includes(page))
    || (!navigationAvailable && value.order.length !== KEYLESS_PAGES.length)
    || value.enabled[0] !== "overview"
    || new Set(value.enabled).size !== value.enabled.length
    || value.enabled.some((page) => !value.order.includes(page))
  ) {
    return false;
  }
  return true;
}

export function normalizePhonePreferences(
  value: PhonePreferences,
  navigationAvailable: boolean,
): PhonePreferences {
  const migrated: PhonePreferences = !value.order.includes("ai")
    ? {
        ...value,
        order: value.order.includes("navigation")
          ? [
              ...value.order.filter((page) => page !== "navigation"),
              "ai" as const,
              "navigation" as const,
            ]
          : [...value.order, "ai" as const],
        enabled: [...value.enabled, "ai" as const],
      }
    : value;
  if (!isValidLayout(migrated, navigationAvailable)) {
    return {
      ...DEFAULT_PHONE_PREFERENCES,
      locale: isLocaleSetting(value.locale) ? value.locale : "system",
      order: navigationAvailable
        ? [...DEFAULT_PHONE_PREFERENCES.order, "navigation"]
        : [...DEFAULT_PHONE_PREFERENCES.order],
      enabled: [...DEFAULT_PHONE_PREFERENCES.enabled],
    };
  }
  return {
    ...clonePreferences(migrated),
    order: navigationAvailable && !migrated.order.includes("navigation")
      ? [...migrated.order, "navigation"]
      : [...migrated.order],
  };
}

export async function resolvePhonePreferences(
  storage: EvenStorage,
  navigationAvailable: boolean,
): Promise<PhonePreferences> {
  const cached = await readCache(
    storage,
    "phone-preferences",
    isPhonePreferences,
  );
  return normalizePhonePreferences(
    cached ?? DEFAULT_PHONE_PREFERENCES,
    navigationAvailable,
  );
}

export function writePhonePreferences(
  storage: EvenStorage,
  value: PhonePreferences,
): Promise<boolean> {
  return writeCache(storage, "phone-preferences", clonePreferences(value));
}
