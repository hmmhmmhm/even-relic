import { describe, expect, it } from "vitest";
import {
  AI_HUD_ACTIVITY_TRANSLATIONS,
  AI_HUD_TRANSLATIONS,
  aiHudStatusLabel,
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
      expect(Object.values(AI_HUD_ACTIVITY_TRANSLATIONS[locale]).every(
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

  it("prioritizes safe tool status over delayed and normal phases", () => {
    const base = {
      configured: true,
      phase: "displaying" as const,
      userText: "",
      assistantText: "",
      turns: [],
      transcriptLines: [],
      history: [],
      weekUsd: 0,
      monthUsd: 0,
      responseComplete: false,
      canRevealFullResponse: false,
    };
    expect(aiHudStatusLabel({
      ...base,
      activeTool: { id: "search-1", kind: "web-search" },
    }, "ko")).toBe("웹 검색 중…");
    expect(aiHudStatusLabel({
      ...base,
      activeTool: { id: "mcp-1", kind: "mcp", displayName: "Docs" },
    }, "en")).toBe("USING MCP // Docs");
    expect(aiHudStatusLabel(base, "en")).toBe("DISPLAYING RESPONSE…");
  });
});
