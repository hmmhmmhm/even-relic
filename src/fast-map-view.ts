import type { HudPage } from "./canvas-hud";

export const FAST_MAP_ZOOM_RADII = [850, 650, 500, 375, 280] as const;
export const FAST_MAP_DEFAULT_ZOOM_INDEX = 1;

export type FastMapInput =
  | "tap"
  | "double-tap"
  | "scroll-next"
  | "scroll-previous";
export type FastMapInputResult = "unhandled" | "consume" | "redraw";
export type FastMapViewState = {
  readonly mode: "dashboard" | "fullscreen";
  readonly zoomIndex: number;
};
export type FastMapTransition = {
  readonly state: FastMapViewState;
  readonly result: FastMapInputResult;
};

export function createFastMapViewState(): FastMapViewState {
  return {
    mode: "dashboard",
    zoomIndex: FAST_MAP_DEFAULT_ZOOM_INDEX,
  };
}

export function reduceFastMapInput(
  state: FastMapViewState,
  page: HudPage,
  input: FastMapInput,
): FastMapTransition {
  if (state.mode === "dashboard") {
    if (page === "overview" && input === "tap") {
      return {
        state: { ...state, mode: "fullscreen" },
        result: "redraw",
      };
    }
    return { state, result: "unhandled" };
  }
  if (input === "double-tap") {
    return {
      state: { ...state, mode: "dashboard" },
      result: "redraw",
    };
  }
  if (input === "scroll-next") {
    if (state.zoomIndex >= FAST_MAP_ZOOM_RADII.length - 1) {
      return { state, result: "consume" };
    }
    return {
      state: { ...state, zoomIndex: state.zoomIndex + 1 },
      result: "redraw",
    };
  }
  if (input === "scroll-previous") {
    if (state.zoomIndex <= 0) return { state, result: "consume" };
    return {
      state: { ...state, zoomIndex: state.zoomIndex - 1 },
      result: "redraw",
    };
  }
  return { state, result: "consume" };
}
