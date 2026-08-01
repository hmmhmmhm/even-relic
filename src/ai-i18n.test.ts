import { describe, expect, it } from "vitest";
import { translateAiPhone, type AiPhoneStringKey } from "./ai-i18n";
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
];

describe("Ask AI phone translations", () => {
  it("resolves every Ask AI string for all 30 supported locales", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(30);
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of KEYS) {
        expect(translateAiPhone(locale, key).trim()).not.toBe("");
      }
    }
  });
});
