import { describe, expect, it } from "vitest";
import { createAiHudSnapshot, updateAiHudProtocol } from "./ai-hud-state";
import { createRealtimeProtocolState } from "./ai-realtime-protocol";

describe("Ask AI HUD state", () => {
  it("is passive until an explicit session starts", () => {
    const state = createAiHudSnapshot(false);
    expect(state.phase).toBe("unconfigured");
    expect(state.transcriptPages).toEqual([]);
  });

  it("builds readable transcript pages from streaming state", () => {
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "thinking" as const,
      userText: "오늘 일정 알려줘",
      assistantText: "오후 세 시에 회의가 있습니다. ".repeat(12),
    };
    const state = updateAiHudProtocol(createAiHudSnapshot(true), protocol);
    expect(state.phase).toBe("thinking");
    expect(state.transcriptPages.length).toBeGreaterThan(1);
    expect(state.transcriptPages[0]).toContain("오늘 일정");
  });
});
