import { describe, expect, it, vi } from "vitest";
import { createAiHudSnapshot } from "./ai-hud-state";
import { createAiPresentationPacer } from "./ai-presentation-pacer";

describe("Ask AI presentation pacer", () => {
  it("reveals at most six Unicode graphemes every 250 ms", async () => {
    vi.useFakeTimers();
    const frames: Array<{ text: string; phase: string; settled: boolean }> = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot, settled) => frames.push({
        text: snapshot.assistantText,
        phase: snapshot.phase,
        settled,
      }),
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      userText: "질문",
      assistantText: "가나다라마바사아자차카타",
    });

    expect(frames).toEqual([]);
    await vi.advanceTimersByTimeAsync(250);
    expect(frames.at(-1)).toEqual({
      text: "가나다라마바",
      phase: "displaying",
      settled: false,
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(frames.at(-1)).toEqual({
      text: "가나다라마바사아자차카타",
      phase: "thinking",
      settled: false,
    });
    pacer.dispose();
    vi.useRealTimers();
  });

  it("keeps only the newest target rather than replaying queued deltas", async () => {
    vi.useFakeTimers();
    const texts: string[] = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => texts.push(snapshot.assistantText),
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      assistantText: "오래된",
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      assistantText: "최신응답전체문장",
    });

    await vi.advanceTimersByTimeAsync(250);
    expect(texts).toEqual(["최신응답전체"]);
    pacer.dispose();
    vi.useRealTimers();
  });

  it("publishes user and listening states immediately, then settles the final answer", async () => {
    vi.useFakeTimers();
    const frames: Array<{ text: string; phase: string; settled: boolean }> = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot, settled) => frames.push({
        text: snapshot.assistantText,
        phase: snapshot.phase,
        settled,
      }),
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "listening",
      userText: "바로 보이는 질문",
    });
    expect(frames.at(-1)).toEqual({
      text: "",
      phase: "listening",
      settled: false,
    });

    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "listening",
      userText: "바로 보이는 질문",
      assistantText: "짧은 답변",
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(frames.at(-1)).toEqual({
      text: "짧은 답변",
      phase: "listening",
      settled: true,
    });
    pacer.dispose();
    vi.useRealTimers();
  });

  it("cancels a pending presentation when disposed", async () => {
    vi.useFakeTimers();
    const onFrame = vi.fn();
    const pacer = createAiPresentationPacer({ onFrame });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      assistantText: "표시하지 않을 답변",
    });
    pacer.dispose();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onFrame).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
