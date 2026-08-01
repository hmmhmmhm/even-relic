import { describe, expect, it } from "vitest";
import {
  AI_HUD_TRANSLATIONS,
  localizeAiTranscriptPage,
  translateAiHud,
} from "./ai-hud-i18n";
import { SUPPORTED_LOCALES } from "./i18n/locale-registry";

describe("Ask AI HUD translations", () => {
  it("provides a complete non-empty dictionary for every supported locale", () => {
    expect(Object.keys(AI_HUD_TRANSLATIONS).sort()).toEqual(
      [...SUPPORTED_LOCALES].sort(),
    );

    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.values(AI_HUD_TRANSLATIONS[locale]).every(
        (value) => value.trim().length > 0,
      )).toBe(true);
    }
  });

  it("localizes phases and transcript roles without changing conversation text", () => {
    expect(translateAiHud("ko", "listening")).toBe("듣는 중…");
    expect(localizeAiTranscriptPage(
      "YOU // 안녕하세요\n      이어지는 말\nAI // 반갑습니다",
      "ko",
    )).toBe("사용자 // 안녕하세요\n      이어지는 말\nAI // 반갑습니다");
  });
});
