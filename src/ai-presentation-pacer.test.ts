import { describe, expect, it, vi } from "vitest";
import { createAiHudSnapshot } from "./ai-hud-state";
import { createAiPresentationPacer } from "./ai-presentation-pacer";

describe("Ask AI presentation pacer", () => {
  it("reveals exactly one Unicode grapheme every 500 ms", async () => {
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
      assistantText: "가나다",
    });

    expect(frames).toEqual([]);
    await vi.advanceTimersByTimeAsync(499);
    expect(frames).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(frames.at(-1)).toEqual({
      text: "가",
      phase: "displaying",
      settled: false,
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(frames.at(-1)).toEqual({
      text: "가나",
      phase: "displaying",
      settled: false,
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(frames.at(-1)).toEqual({
      text: "가나다",
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

    await vi.advanceTimersByTimeAsync(1_000);
    expect(texts).toEqual(["최", "최신"]);
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
    await vi.advanceTimersByTimeAsync(2_500);
    expect(frames.at(-1)).toEqual({
      text: "짧은 답변",
      phase: "listening",
      settled: true,
    });
    pacer.dispose();
    vi.useRealTimers();
  });

  it("keeps a composed emoji together as one visible grapheme", async () => {
    vi.useFakeTimers();
    const texts: string[] = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => texts.push(snapshot.assistantText),
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      assistantText: "👨‍👩‍👧‍👦좋아",
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(texts).toEqual(["👨‍👩‍👧‍👦"]);
    await vi.advanceTimersByTimeAsync(500);
    expect(texts.at(-1)).toBe("👨‍👩‍👧‍👦좋");
    pacer.dispose();
    vi.useRealTimers();
  });

  it("rebuilds the visible transcript from each paced grapheme", async () => {
    vi.useFakeTimers();
    const lines: Array<readonly string[]> = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => lines.push(snapshot.transcriptLines),
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      userText: "질문",
      assistantText: "답변",
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(lines.at(-1)).toEqual([
      "YOU // 질문",
      "AI // 답",
    ]);
    pacer.dispose();
    vi.useRealTimers();
  });

  it("does not reveal a completed turn when Realtime archives it", async () => {
    vi.useFakeTimers();
    const frames: Array<readonly string[]> = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => frames.push(snapshot.transcriptLines),
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      userText: "질문",
      assistantText: "가나다",
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(frames.at(-1)).toEqual([
      "YOU // 질문",
      "AI // 가",
    ]);

    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "listening",
      turns: [{ user: "질문", assistant: "가나다" }],
      transcriptLines: ["YOU // 질문", "AI // 가나다"],
    });
    expect(frames.at(-1)).toEqual([
      "YOU // 질문",
      "AI // 가",
    ]);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(frames.at(-1)).toEqual([
      "YOU // 질문",
      "AI // 가나다",
    ]);
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
