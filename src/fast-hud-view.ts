import type { HudPage } from "./canvas-hud";
import type {
  FastCanvasInput,
  FastCanvasInputResult,
} from "./fast-canvas-transport";

export const FAST_MAP_ZOOM_RADII = [850, 650, 500, 375, 280] as const;
export const FAST_MAP_DEFAULT_ZOOM_INDEX = 1;

export type FastHudViewMode =
  | "dashboard"
  | "map"
  | "news"
  | "todo"
  | "navigation";

export type FastHudViewState = {
  readonly mode: FastHudViewMode;
  readonly zoomIndex: number;
  readonly newsIndex: number;
  readonly todoIndex: number;
  readonly navigationIndex: number;
  readonly navigationFollowsActive: boolean;
};

export type FastHudViewContext = {
  readonly newsCount: number;
  readonly todoCount: number;
  readonly maneuverCount: number;
  readonly activeManeuverIndex: number;
};

export type FastHudEffect = {
  readonly type: "toggle-todo";
  readonly index: number;
};

export type FastHudTransition = {
  readonly state: FastHudViewState;
  readonly result: FastCanvasInputResult;
  readonly effect?: FastHudEffect;
};

function clampIndex(index: number, count: number): number {
  const lastIndex = Math.max(0, Math.floor(count) - 1);
  return Math.min(Math.max(0, Math.floor(index)), lastIndex);
}

function clampZoom(index: number): number {
  return clampIndex(index, FAST_MAP_ZOOM_RADII.length);
}

function pageMode(page: HudPage): Exclude<FastHudViewMode, "dashboard"> {
  return page === "overview" ? "map" : page;
}

function moveIndex(
  state: FastHudViewState,
  key: "newsIndex" | "todoIndex" | "navigationIndex",
  input: FastCanvasInput,
  count: number,
  extra: Partial<FastHudViewState> = {},
): FastHudTransition {
  const delta = input === "scroll-next"
    ? 1
    : input === "scroll-previous"
      ? -1
      : 0;
  if (delta === 0 || count <= 0) {
    return { state, result: "consume" };
  }
  const nextIndex = clampIndex(state[key] + delta, count);
  if (nextIndex === state[key]) return { state, result: "consume" };
  return {
    state: { ...state, ...extra, [key]: nextIndex },
    result: "redraw",
  };
}

export function createFastHudViewState(): FastHudViewState {
  return {
    mode: "dashboard",
    zoomIndex: FAST_MAP_DEFAULT_ZOOM_INDEX,
    newsIndex: 0,
    todoIndex: 0,
    navigationIndex: 0,
    navigationFollowsActive: true,
  };
}

export function syncFastHudView(
  state: FastHudViewState,
  context: FastHudViewContext,
): FastHudViewState {
  const activeIndex = clampIndex(
    context.activeManeuverIndex,
    context.maneuverCount,
  );
  return {
    ...state,
    zoomIndex: clampZoom(state.zoomIndex),
    newsIndex: clampIndex(state.newsIndex, context.newsCount),
    todoIndex: clampIndex(state.todoIndex, context.todoCount),
    navigationIndex: state.navigationFollowsActive
      ? activeIndex
      : clampIndex(state.navigationIndex, context.maneuverCount),
  };
}

export function reduceFastHudInput(
  current: FastHudViewState,
  page: HudPage,
  input: FastCanvasInput,
  context: FastHudViewContext,
): FastHudTransition {
  if (current.mode === "dashboard") {
    if (input !== "tap") return { state: current, result: "unhandled" };
    const state = syncFastHudView(current, context);
    const mode = pageMode(page);
    return {
      state: mode === "navigation"
        ? {
            ...state,
            mode,
            navigationIndex: clampIndex(
              context.activeManeuverIndex,
              context.maneuverCount,
            ),
            navigationFollowsActive: true,
          }
        : { ...state, mode },
      result: "redraw",
    };
  }

  const state = current.mode === "map"
    ? { ...current, zoomIndex: clampZoom(current.zoomIndex) }
    : current.mode === "news"
      ? {
          ...current,
          newsIndex: clampIndex(current.newsIndex, context.newsCount),
        }
      : current.mode === "todo"
        ? {
            ...current,
            todoIndex: clampIndex(current.todoIndex, context.todoCount),
          }
        : {
            ...current,
            navigationIndex: current.navigationFollowsActive
              ? clampIndex(
                  context.activeManeuverIndex,
                  context.maneuverCount,
                )
              : clampIndex(
                  current.navigationIndex,
                  context.maneuverCount,
                ),
          };

  if (input === "double-tap") {
    return {
      state: { ...state, mode: "dashboard" },
      result: "redraw",
    };
  }

  if (state.mode === "map") {
    if (input !== "scroll-next" && input !== "scroll-previous") {
      return { state, result: "consume" };
    }
    const delta = input === "scroll-next" ? -1 : 1;
    const zoomIndex = clampZoom(state.zoomIndex + delta);
    return zoomIndex === state.zoomIndex
      ? { state, result: "consume" }
      : { state: { ...state, zoomIndex }, result: "redraw" };
  }

  if (state.mode === "news") {
    return moveIndex(
      state,
      "newsIndex",
      input,
      context.newsCount,
    );
  }

  if (state.mode === "todo") {
    if (input === "tap") {
      return context.todoCount <= 0
        ? { state, result: "consume" }
        : {
            state,
            result: "consume",
            effect: { type: "toggle-todo", index: state.todoIndex },
          };
    }
    return moveIndex(
      state,
      "todoIndex",
      input,
      context.todoCount,
    );
  }

  if (input === "tap") {
    if (context.maneuverCount <= 0) {
      return { state, result: "consume" };
    }
    const navigationIndex = clampIndex(
      context.activeManeuverIndex,
      context.maneuverCount,
    );
    if (
      navigationIndex === state.navigationIndex
      && state.navigationFollowsActive
    ) {
      return { state, result: "consume" };
    }
    return {
      state: {
        ...state,
        navigationIndex,
        navigationFollowsActive: true,
      },
      result: "redraw",
    };
  }
  return moveIndex(
    state,
    "navigationIndex",
    input,
    context.maneuverCount,
    { navigationFollowsActive: false },
  );
}
