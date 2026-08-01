import { describe, expect, it } from "vitest";
import {
  AI_HUD_TRANSLATIONS,
  localizeAiTranscriptLines,
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
    expect(localizeAiTranscriptLines([
      "YOU // 안녕하세요",
      "      이어지는 말",
      "AI // 반갑습니다",
    ],
      "ko",
    )).toEqual([
      "사용자 // 안녕하세요",
      "      이어지는 말",
      "AI // 반갑습니다",
    ]);
  });
});
