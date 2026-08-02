import { describe, expect, it } from "vitest";
import { createAiHudSnapshot, updateAiHudProtocol } from "./ai-hud-state";
import { createRealtimeProtocolState } from "./ai-realtime-protocol";

describe("Ask AI HUD state", () => {
  it("is passive until an explicit session starts", () => {
    const state = createAiHudSnapshot(false);
    expect(state.phase).toBe("unconfigured");
    expect(state.transcriptLines).toEqual([]);
  });

  it("keeps a short user utterance and streaming answer as chronological lines", () => {
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "thinking" as const,
      userText: "안녕하세요.",
      assistantText: "안녕하세요. 무엇을 도와드릴까요?",
    };

    const state = updateAiHudProtocol(createAiHudSnapshot(true), protocol);

    expect(state.transcriptLines).toEqual([
      "YOU // 안녕하세요.",
      "AI // 안녕하세요. 무엇을 도와드릴까요?",
    ]);
  });

  it("builds an unpaged chronological line stream", () => {
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "thinking" as const,
      turns: [{
        user: "첫 번째 질문",
        assistant: "첫 번째 답변",
      }],
      userText: "오늘 일정 알려줘",
      assistantText: "오후 세 시에 회의가 있습니다. ".repeat(12),
    };
    const state = updateAiHudProtocol(createAiHudSnapshot(true), protocol);
    expect(state.phase).toBe("thinking");
    expect(state.turns).toEqual(protocol.turns);
    expect(state.transcriptLines.length).toBeGreaterThan(6);
    expect(state.transcriptLines.join("\n")).toContain("첫 번째 질문");
    expect(state.transcriptLines.join("\n")).toContain("오늘 일정");
    expect(state.transcriptLines.every((line) => !line.includes("\n")))
      .toBe(true);
  });

  it("projects only bounded safe tool lifecycle fields", () => {
    const protocol = {
      ...createRealtimeProtocolState(),
      activeTool: {
        id: "call-1",
        kind: "web-search" as const,
        displayName: "Search",
      },
      responseComplete: true,
    };
    const state = updateAiHudProtocol(createAiHudSnapshot(true), protocol);
    expect(state.activeTool).toEqual(protocol.activeTool);
    expect(state.responseComplete).toBe(true);
    expect(JSON.stringify(state)).not.toContain("private query");
  });
});
