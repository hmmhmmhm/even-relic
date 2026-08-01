import { describe, expect, it, vi } from "vitest";
import { createAiHudSnapshot } from "./ai-hud-state";
import { createAiPresentationPacer } from "./ai-presentation-pacer";

describe("Ask AI presentation pacer", () => {
  it("reveals exactly one Unicode grapheme every 250 ms", async () => {
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
    await vi.advanceTimersByTimeAsync(249);
    expect(frames).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(frames.at(-1)).toEqual({
      text: "가",
      phase: "displaying",
      settled: false,
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(frames.at(-1)).toEqual({
      text: "가나",
      phase: "displaying",
      settled: false,
    });
    await vi.advanceTimersByTimeAsync(250);
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

    await vi.advanceTimersByTimeAsync(500);
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
    await vi.advanceTimersByTimeAsync(1_250);
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

    await vi.advanceTimersByTimeAsync(250);
    expect(texts).toEqual(["👨‍👩‍👧‍👦"]);
    await vi.advanceTimersByTimeAsync(250);
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

    await vi.advanceTimersByTimeAsync(250);
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
    await vi.advanceTimersByTimeAsync(250);
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

    await vi.advanceTimersByTimeAsync(500);
    expect(frames.at(-1)).toEqual([
      "YOU // 질문",
      "AI // 가나다",
    ]);
    pacer.dispose();
    vi.useRealTimers();
  });

  it("paces late text that expands an already archived turn", async () => {
    vi.useFakeTimers();
    const frames: Array<readonly string[]> = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => frames.push(snapshot.transcriptLines),
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      userText: "질문",
      assistantText: "가",
    });
    await vi.advanceTimersByTimeAsync(250);

    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "listening",
      turns: [{ user: "질문", assistant: "가" }],
      transcriptLines: ["YOU // 질문", "AI // 가"],
    });
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
    await vi.advanceTimersByTimeAsync(250);
    expect(frames.at(-1)).toEqual([
      "YOU // 질문",
      "AI // 가나",
    ]);
    await vi.advanceTimersByTimeAsync(250);
    expect(frames.at(-1)).toEqual([
      "YOU // 질문",
      "AI // 가나다",
    ]);
    pacer.dispose();
    vi.useRealTimers();
  });

  it("waits for the glasses update before presenting the next grapheme", async () => {
    vi.useFakeTimers();
    const texts: string[] = [];
    let release: (() => void) | undefined;
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => {
        texts.push(snapshot.assistantText);
        return new Promise<void>((resolve) => { release = resolve; });
      },
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      assistantText: "가나다",
    });

    await vi.advanceTimersByTimeAsync(250);
    expect(texts).toEqual(["가"]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(texts).toEqual(["가"]);

    release?.();
    await vi.advanceTimersByTimeAsync(249);
    expect(texts).toEqual(["가"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(texts).toEqual(["가", "가나"]);
    pacer.dispose();
    vi.useRealTimers();
  });

  it("shows the current response after an earlier turn was archived", async () => {
    vi.useFakeTimers();
    const frames: Array<readonly string[]> = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => frames.push(snapshot.transcriptLines),
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      userText: "첫 질문",
      assistantText: "첫 답",
    });
    await vi.advanceTimersByTimeAsync(750);
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "listening",
      turns: [{ user: "첫 질문", assistant: "첫 답" }],
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      turns: [{ user: "첫 질문", assistant: "첫 답" }],
      userText: "둘째 질문",
      assistantText: "둘째 답",
    });

    await vi.advanceTimersByTimeAsync(250);
    expect(frames.at(-1)).toEqual([
      "YOU // 첫 질문",
      "AI // 첫 답",
      "YOU // 둘째 질문",
      "AI // 둘",
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
    await vi.advanceTimersByTimeAsync(500);
    expect(onFrame).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("flushes the newest complete target in one acknowledged frame", async () => {
    vi.useFakeTimers();
    const texts: string[] = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => { texts.push(snapshot.assistantText); },
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "listening",
      assistantText: "전체 답변",
    });

    await pacer.flush();

    expect(texts).toEqual(["전체 답변"]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(texts).toEqual(["전체 답변"]);
    pacer.dispose();
    vi.useRealTimers();
  });

  it("serializes a flush behind the native text update already in flight", async () => {
    vi.useFakeTimers();
    const texts: string[] = [];
    const releases: Array<() => void> = [];
    const pacer = createAiPresentationPacer({
      onFrame: (snapshot) => {
        texts.push(snapshot.assistantText);
        return new Promise<void>((resolve) => { releases.push(resolve); });
      },
    });
    pacer.push({
      ...createAiHudSnapshot(true),
      phase: "thinking",
      assistantText: "가나다",
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(texts).toEqual(["가"]);

    let flushed = false;
    const flushing = pacer.flush().then(() => { flushed = true; });
    expect(texts).toEqual(["가"]);
    releases.shift()?.();
    await vi.waitFor(() => expect(texts).toEqual(["가", "가나다"]));
    expect(flushed).toBe(false);
    releases.shift()?.();
    await flushing;
    expect(flushed).toBe(true);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(texts).toEqual(["가", "가나다"]);
    pacer.dispose();
    vi.useRealTimers();
  });
});
