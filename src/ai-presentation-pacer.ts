import type { AiHudSnapshot } from "./ai-hud-state";
import { createAiTranscriptLines } from "./ai-transcript";

export type AiPresentationPacer = {
  push(snapshot: AiHudSnapshot): void;
  reset(): void;
  dispose(): void;
};

export function createAiPresentationPacer(options: {
  readonly onFrame: (snapshot: AiHudSnapshot, settled: boolean) => void;
  readonly intervalMs?: number;
  readonly graphemesPerTick?: number;
}): AiPresentationPacer {
  const intervalMs = Math.max(1, options.intervalMs ?? 500);
  const step = Math.max(1, Math.floor(options.graphemesPerTick ?? 1));
  let target: AiHudSnapshot | undefined;
  let presented = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const segmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;

  const graphemes = (value: string): readonly string[] => {
    if (segmenter) {
      return Array.from(segmenter.segment(value), ({ segment }) => segment);
    }
    return Array.from(value);
  };

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const schedule = () => {
    if (disposed || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed || !target) return;
      const available = graphemes(target.assistantText);
      const current = target.assistantText.startsWith(presented)
        ? graphemes(presented)
        : [];
      presented = available.slice(0, current.length + step).join("");
      const caughtUp = presented === target.assistantText;
      const frame: AiHudSnapshot = {
        ...target,
        phase: caughtUp ? target.phase : "displaying",
        assistantText: presented,
        transcriptLines: createAiTranscriptLines(target.turns, {
          user: target.userText,
          assistant: presented,
        }),
      };
      options.onFrame(
        frame,
        caughtUp && target.phase === "listening",
      );
      if (!caughtUp) schedule();
    }, intervalMs);
  };

  return {
    push(snapshot) {
      if (disposed) return;
      const previousTurns = target?.turns.length ?? snapshot.turns.length;
      target = snapshot;
      if (
        snapshot.phase === "error"
        || !snapshot.assistantText
        || snapshot.turns.length !== previousTurns
      ) {
        clearTimer();
        presented = snapshot.assistantText;
        options.onFrame(snapshot, snapshot.phase === "error");
        return;
      }
      if (!snapshot.assistantText.startsWith(presented)) presented = "";
      if (snapshot.assistantText === presented) {
        clearTimer();
        options.onFrame(snapshot, snapshot.phase === "listening");
        return;
      }
      schedule();
    },
    reset() {
      clearTimer();
      target = undefined;
      presented = "";
    },
    dispose() {
      disposed = true;
      clearTimer();
      target = undefined;
      presented = "";
    },
  };
}
