import { describe, expect, it } from "vitest";
import {
  AI_PHONE_CONTROL_TRANSLATIONS,
  translateAiPhone,
  type AiPhoneStringKey,
} from "./ai-i18n";
import { SUPPORTED_LOCALES } from "./i18n/locale-registry";

const KEYS: readonly AiPhoneStringKey[] = [
  "ai",
  "openAiKey",
  "estimatedCost",
  "thisWeek",
  "thisMonth",
  "recentConversations",
  "noConversations",
  "clearAiData",
  "aiKeyRequired",
  "responseSpeed",
  "millisecondsPerCharacter",
  "unpricedUsage",
];

describe("Ask AI phone translations", () => {
  it("provides complete controls and price warnings for every locale", () => {
    expect(Object.keys(AI_PHONE_CONTROL_TRANSLATIONS).sort())
      .toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.values(AI_PHONE_CONTROL_TRANSLATIONS[locale]).every(
        (value) => value.trim().length > 0,
      )).toBe(true);
    }
  });
  it("resolves every Ask AI string for all 180 supported locales", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(180);
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of KEYS) {
        expect(translateAiPhone(locale, key).trim()).not.toBe("");
      }
    }
  });
});
