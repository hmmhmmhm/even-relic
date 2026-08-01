import type { AiRuntime } from "./ai-runtime";
import type {
  FastCanvasInput,
  FastCanvasInputResult,
  FastCanvasNativeTextController,
} from "./fast-canvas-types";
import type { FastHudPage } from "./fast-hud-pages";
import {
  reduceFastHudInput,
  type FastHudViewContext,
  type FastHudViewState,
} from "./fast-hud-view";

type InteractiveLiveSession = {
  toggleTodo(index: number): Promise<boolean>;
  refreshNewsIfDue?(): void;
};

export function createFastHudInputController(options: {
  readonly getView: () => FastHudViewState;
  readonly setView: (view: FastHudViewState) => void;
  readonly getPage: () => FastHudPage;
  readonly getContext: () => FastHudViewContext;
  readonly getLiveSession: () => InteractiveLiveSession | undefined;
  readonly getAiRuntime: () => AiRuntime | undefined;
  readonly getNativeText: () => FastCanvasNativeTextController | undefined;
  readonly nativeContent: () => string;
  readonly drawCurrentPage: () => void;
  readonly log?: (message: string) => void;
}) {
  return async (input: FastCanvasInput): Promise<FastCanvasInputResult> => {
    const previous = options.getView();
    const transition = reduceFastHudInput(
      previous,
      options.getPage(),
      input,
      options.getContext(),
    );
    options.setView(transition.state);
    options.log?.(
      `app ${input} · ${transition.result}`
        + (transition.effect ? ` · effect ${transition.effect.type}` : ""),
    );

    if (transition.effect?.type === "toggle-todo") {
      const changed = await options.getLiveSession()?.toggleTodo(
        transition.effect.index,
      ) ?? false;
      if (!changed) return "consume";
      options.drawCurrentPage();
      return "redraw";
    }

    const nativeText = options.getNativeText();
    const aiRuntime = options.getAiRuntime();
    if (transition.effect?.type === "start-ai") {
      if (nativeText) {
        if (!aiRuntime || !await nativeText.enter(options.nativeContent())) {
          options.setView(previous);
          return "consume";
        }
        void aiRuntime.start();
        return "consume";
      }
      void aiRuntime?.start();
    } else if (transition.effect?.type === "toggle-ai") {
      const changed = await aiRuntime?.toggle() ?? false;
      if (!changed) return "consume";
      if (nativeText?.active()) {
        await nativeText.update(options.nativeContent());
        return "consume";
      }
      options.drawCurrentPage();
      return "redraw";
    } else if (transition.effect?.type === "stop-ai") {
      await aiRuntime?.stop();
      if (nativeText?.active()) {
        options.drawCurrentPage();
        if (!await nativeText.restore()) options.setView(previous);
        return "consume";
      }
    }

    if (
      transition.state.mode === "ai"
      && transition.result === "redraw"
      && nativeText?.active()
    ) {
      await nativeText.update(options.nativeContent());
      return "consume";
    }
    if (transition.result === "redraw") options.drawCurrentPage();
    if (previous.mode === "news" && transition.state.mode !== "news") {
      options.getLiveSession()?.refreshNewsIfDue?.();
    }
    return transition.result;
  };
}
