import { describe, expect, it } from "vitest";
import {
  FAST_MAP_DEFAULT_ZOOM_INDEX,
  FAST_MAP_ZOOM_RADII,
  createFastMapViewState,
  reduceFastMapInput,
  type FastMapViewState,
} from "./fast-map-view";

describe("fast map view state", () => {
  it("enters only from overview and returns on fullscreen double tap", () => {
    const initial = createFastMapViewState();
    expect(reduceFastMapInput(initial, "news", "tap")).toEqual({
      state: initial,
      result: "unhandled",
    });
    const entered = reduceFastMapInput(initial, "overview", "tap");
    expect(entered).toEqual({
      state: {
        mode: "fullscreen",
        zoomIndex: FAST_MAP_DEFAULT_ZOOM_INDEX,
      },
      result: "redraw",
    });
    expect(reduceFastMapInput(
      entered.state,
      "overview",
      "double-tap",
    )).toEqual({
      state: initial,
      result: "redraw",
    });
  });

  it("zooms in on bottom, out on top, and consumes both bounds", () => {
    let state: FastMapViewState = { mode: "fullscreen", zoomIndex: 1 };
    state = reduceFastMapInput(state, "overview", "scroll-next").state;
    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(500);
    state = reduceFastMapInput(state, "overview", "scroll-previous").state;
    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(650);
    expect(reduceFastMapInput(
      { mode: "fullscreen", zoomIndex: 0 },
      "overview",
      "scroll-previous",
    ).result).toBe("consume");
    expect(reduceFastMapInput(
      {
        mode: "fullscreen",
        zoomIndex: FAST_MAP_ZOOM_RADII.length - 1,
      },
      "overview",
      "scroll-next",
    ).result).toBe("consume");
  });

  it("leaves dashboard scroll and double tap unhandled", () => {
    const state = createFastMapViewState();
    for (const input of [
      "scroll-next",
      "scroll-previous",
      "double-tap",
    ] as const) {
      expect(reduceFastMapInput(state, "overview", input)).toEqual({
        state,
        result: "unhandled",
      });
    }
  });

  it("consumes a fullscreen tap without changing the retained zoom", () => {
    const state = { mode: "fullscreen" as const, zoomIndex: 3 };

    expect(reduceFastMapInput(state, "overview", "tap")).toEqual({
      state,
      result: "consume",
    });
  });
});
