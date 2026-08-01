import type { AiHudSnapshot } from "./ai-hud-state";
import { createAiTranscriptPages } from "./ai-transcript";

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
  const intervalMs = Math.max(1, options.intervalMs ?? 250);
  const step = Math.max(1, Math.floor(options.graphemesPerTick ?? 6));
  let target: AiHudSnapshot | undefined;
  let presented = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const schedule = () => {
    if (disposed || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed || !target) return;
      const available = Array.from(target.assistantText);
      const current = target.assistantText.startsWith(presented)
        ? Array.from(presented)
        : [];
      presented = available.slice(0, current.length + step).join("");
      const caughtUp = presented === target.assistantText;
      const frame: AiHudSnapshot = {
        ...target,
        phase: caughtUp ? target.phase : "displaying",
        assistantText: presented,
        transcriptPages: createAiTranscriptPages(target.turns, {
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
