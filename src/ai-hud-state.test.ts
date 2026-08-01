import { describe, expect, it } from "vitest";
import { createAiHudSnapshot, updateAiHudProtocol } from "./ai-hud-state";
import { createRealtimeProtocolState } from "./ai-realtime-protocol";

describe("Ask AI HUD state", () => {
  it("is passive until an explicit session starts", () => {
    const state = createAiHudSnapshot(false);
    expect(state.phase).toBe("unconfigured");
    expect(state.transcriptPages).toEqual([]);
  });

  it("keeps a short user utterance and streaming answer on one page", () => {
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "thinking" as const,
      userText: "안녕하세요.",
      assistantText: "안녕하세요. 무엇을 도와드릴까요?",
    };

    const state = updateAiHudProtocol(createAiHudSnapshot(true), protocol);

    expect(state.transcriptPages).toEqual([
      "YOU // 안녕하세요.\nAI // 안녕하세요. 무엇을 도와드릴까요?",
    ]);
  });

  it("builds chronological six-line pages from completed and live turns", () => {
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
    expect(state.transcriptPages.length).toBeGreaterThan(1);
    expect(state.transcriptPages.join("\n")).toContain("첫 번째 질문");
    expect(state.transcriptPages.join("\n")).toContain("오늘 일정");
    for (const page of state.transcriptPages) {
      expect(page.split("\n").length).toBeLessThanOrEqual(6);
    }
  });
});
