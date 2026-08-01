import type { AiHudSnapshot } from "./ai-hud-state";
import { createAiTranscriptLines } from "./ai-transcript";

export type AiPresentationPacer = {
  push(snapshot: AiHudSnapshot): void;
  flush(): Promise<void>;
  reset(): void;
  dispose(): void;
};

export function createAiPresentationPacer(options: {
  readonly onFrame: (
    snapshot: AiHudSnapshot,
    settled: boolean,
    waitForPresentation?: boolean,
  ) => unknown;
  readonly intervalMs?: number;
  readonly graphemesPerTick?: number;
}): AiPresentationPacer {
  const intervalMs = Math.max(1, options.intervalMs ?? 250);
  const step = Math.max(1, Math.floor(options.graphemesPerTick ?? 1));
  type ArchivedPresentation = {
    index: number;
    text: string;
    presented: string;
  };
  let target: AiHudSnapshot | undefined;
  let presented = "";
  const archivedPresentations: ArchivedPresentation[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let presenting = false;
  let flushRequested = false;
  let flushPromise: Promise<void> | undefined;
  let resolveFlush: (() => void) | undefined;
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

  const pendingArchived = () => archivedPresentations.find(
    (entry) => entry.presented !== entry.text,
  );

  const caughtUp = () => Boolean(
    target
    && !pendingArchived()
    && presented === target.assistantText,
  );

  const emit = (waitForPresentation = false) => {
    if (!target) return;
    const archivedByIndex = new Map(
      archivedPresentations.map((entry) => [entry.index, entry]),
    );
    const visibleTurns = target.turns.map((turn, index) => {
      const archived = archivedByIndex.get(index);
      return archived
        ? { ...turn, assistant: archived.presented }
        : turn;
    });
    const visibleAssistant = presented;
    const isCaughtUp = caughtUp();
    const frame: AiHudSnapshot = {
      ...target,
      phase: isCaughtUp ? target.phase : "displaying",
      assistantText: visibleAssistant,
      transcriptLines: createAiTranscriptLines(visibleTurns, {
        user: target.userText,
        assistant: visibleAssistant,
      }),
    };
    return options.onFrame(
      frame,
      isCaughtUp && target.phase === "listening",
      waitForPresentation,
    );
  };

  const completeVisibleTarget = () => {
    if (!target) return;
    for (const archived of archivedPresentations) {
      archived.presented = archived.text;
    }
    presented = target.assistantText;
  };

  const settleFlush = () => {
    const resolve = resolveFlush;
    flushPromise = undefined;
    resolveFlush = undefined;
    resolve?.();
  };

  const runFlush = () => {
    if (presenting) return;
    if (disposed || !target) {
      flushRequested = false;
      settleFlush();
      return;
    }
    clearTimer();
    flushRequested = false;
    presenting = true;
    completeVisibleTarget();
    void Promise.resolve().then(() => emit(true)).finally(() => {
      presenting = false;
      if (flushRequested) {
        runFlush();
        return;
      }
      settleFlush();
      if (!disposed && target && !caughtUp()) schedule();
    });
  };

  const schedule = () => {
    if (disposed || timer !== undefined || presenting || flushRequested) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed || !target) return;
      presenting = true;
      const archived = pendingArchived();
      if (archived) {
        const available = graphemes(archived.text);
        const current = archived.text.startsWith(archived.presented)
          ? graphemes(archived.presented)
          : [];
        archived.presented = available
          .slice(0, current.length + step)
          .join("");
      } else {
        const available = graphemes(target.assistantText);
        const current = target.assistantText.startsWith(presented)
          ? graphemes(presented)
          : [];
        presented = available.slice(0, current.length + step).join("");
      }
      void Promise.resolve(emit(true)).finally(() => {
        presenting = false;
        if (flushRequested) {
          runFlush();
        } else if (!disposed && target && !caughtUp()) {
          schedule();
        }
      });
    }, intervalMs);
  };

  return {
    push(snapshot) {
      if (disposed) return;
      const previous = target;
      const previousTurns = previous?.turns.length ?? snapshot.turns.length;
      target = snapshot;
      if (snapshot.phase === "error") {
        clearTimer();
        archivedPresentations.length = 0;
        presented = snapshot.assistantText;
        options.onFrame(snapshot, snapshot.phase === "error");
        return;
      }

      if (previous && snapshot.turns.length > previousTurns) {
        for (let index = previousTurns; index < snapshot.turns.length; index += 1) {
          const turn = snapshot.turns[index];
          if (!turn?.assistant) continue;
          const movedCurrentTurn = index === previousTurns
            && turn.assistant === previous.assistantText;
          const initial = movedCurrentTurn && turn.assistant.startsWith(presented)
            ? presented
            : "";
          if (movedCurrentTurn || initial !== turn.assistant) {
            archivedPresentations.push({
              index,
              text: turn.assistant,
              presented: initial,
            });
          }
        }
        presented = "";
      }
      for (const archived of archivedPresentations) {
        const latest = snapshot.turns[archived.index]?.assistant;
        if (latest?.startsWith(archived.presented)) archived.text = latest;
      }

      if (pendingArchived()) {
        if (
          !previous
          || snapshot.turns.length !== previousTurns
          || snapshot.userText !== previous.userText
        ) {
          emit();
        }
        schedule();
        return;
      }
      if (!snapshot.assistantText) {
        clearTimer();
        presented = "";
        options.onFrame(snapshot, false);
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
    flush() {
      if (disposed || !target) return Promise.resolve();
      clearTimer();
      flushRequested = true;
      flushPromise ??= new Promise<void>((resolve) => {
        resolveFlush = resolve;
      });
      if (!presenting) runFlush();
      return flushPromise;
    },
    reset() {
      clearTimer();
      flushRequested = false;
      settleFlush();
      target = undefined;
      presented = "";
      archivedPresentations.length = 0;
    },
    dispose() {
      disposed = true;
      clearTimer();
      flushRequested = false;
      settleFlush();
      target = undefined;
      presented = "";
      archivedPresentations.length = 0;
    },
  };
}
