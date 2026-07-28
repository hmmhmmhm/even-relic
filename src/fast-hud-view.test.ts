import { describe, expect, it } from "vitest";
import {
  FAST_MAP_DEFAULT_ZOOM_INDEX,
  FAST_MAP_ZOOM_RADII,
  createFastHudViewState,
  reduceFastHudInput,
  syncFastHudView,
  type FastHudViewContext,
  type FastHudViewState,
} from "./fast-hud-view";

const CONTEXT: FastHudViewContext = {
  newsCount: 6,
  todoCount: 3,
  maneuverCount: 4,
  activeManeuverIndex: 1,
};

describe("fast HUD detail state", () => {
  it("enters the detail deck assigned to every dashboard page", () => {
    const initial = createFastHudViewState();

    expect(reduceFastHudInput(initial, "overview", "tap", CONTEXT).state.mode)
      .toBe("map");
    expect(reduceFastHudInput(initial, "news", "tap", CONTEXT).state.mode)
      .toBe("news");
    expect(reduceFastHudInput(initial, "todo", "tap", CONTEXT).state.mode)
      .toBe("todo");
    expect(
      reduceFastHudInput(initial, "navigation", "tap", CONTEXT).state,
    ).toMatchObject({
      mode: "navigation",
      navigationIndex: 1,
      navigationFollowsActive: true,
    });
  });

  it("leaves dashboard navigation and display toggle inputs unhandled", () => {
    const state = createFastHudViewState();

    for (const input of [
      "scroll-next",
      "scroll-previous",
      "double-tap",
    ] as const) {
      expect(reduceFastHudInput(state, "overview", input, CONTEXT)).toEqual({
        state,
        result: "unhandled",
      });
    }
  });

  it("zooms out on next, in on previous, and consumes zoom boundaries", () => {
    let state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "map",
    };

    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(650);
    state = reduceFastHudInput(
      state,
      "overview",
      "scroll-next",
      CONTEXT,
    ).state;
    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(850);
    state = reduceFastHudInput(
      { ...state, zoomIndex: FAST_MAP_DEFAULT_ZOOM_INDEX },
      "overview",
      "scroll-previous",
      CONTEXT,
    ).state;
    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(500);
    expect(reduceFastHudInput(
      { ...state, zoomIndex: 0 },
      "overview",
      "scroll-next",
      CONTEXT,
    ).result).toBe("consume");
    expect(reduceFastHudInput(
      { ...state, zoomIndex: FAST_MAP_ZOOM_RADII.length - 1 },
      "overview",
      "scroll-previous",
      CONTEXT,
    ).result).toBe("consume");
  });

  it("moves through news and consumes taps and list boundaries", () => {
    const state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "news",
      newsIndex: 1,
    };

    expect(reduceFastHudInput(
      state,
      "news",
      "scroll-next",
      CONTEXT,
    )).toMatchObject({
      state: { newsIndex: 2 },
      result: "redraw",
    });
    expect(reduceFastHudInput(state, "news", "tap", CONTEXT)).toEqual({
      state,
      result: "consume",
    });
    expect(reduceFastHudInput(
      { ...state, newsIndex: 5 },
      "news",
      "scroll-next",
      CONTEXT,
    ).result).toBe("consume");
  });

  it("selects and toggles TODO items without changing the state first", () => {
    const state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "todo",
      todoIndex: 0,
    };
    const selected = reduceFastHudInput(
      state,
      "todo",
      "scroll-next",
      CONTEXT,
    ).state;

    expect(selected.todoIndex).toBe(1);
    expect(reduceFastHudInput(selected, "todo", "tap", CONTEXT)).toEqual({
      state: selected,
      result: "consume",
      effect: { type: "toggle-todo", index: 1 },
    });
    expect(reduceFastHudInput(
      { ...state, todoIndex: 2 },
      "todo",
      "scroll-next",
      CONTEXT,
    ).result).toBe("consume");
  });

  it("browses route steps, then returns to the active step on tap", () => {
    const state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "navigation",
      navigationIndex: 1,
      navigationFollowsActive: true,
    };
    const browsed = reduceFastHudInput(
      state,
      "navigation",
      "scroll-next",
      CONTEXT,
    );

    expect(browsed).toMatchObject({
      state: {
        navigationIndex: 2,
        navigationFollowsActive: false,
      },
      result: "redraw",
    });
    expect(reduceFastHudInput(
      browsed.state,
      "navigation",
      "tap",
      CONTEXT,
    )).toMatchObject({
      state: {
        navigationIndex: 1,
        navigationFollowsActive: true,
      },
      result: "redraw",
    });
  });

  it("returns from every detail deck on double tap and retains indices", () => {
    for (const mode of ["map", "news", "todo", "navigation"] as const) {
      const state: FastHudViewState = {
        ...createFastHudViewState(),
        mode,
        zoomIndex: 3,
        newsIndex: 2,
        todoIndex: 1,
        navigationIndex: 2,
        navigationFollowsActive: false,
      };

      expect(reduceFastHudInput(
        state,
        "overview",
        "double-tap",
        CONTEXT,
      )).toEqual({
        state: { ...state, mode: "dashboard" },
        result: "redraw",
      });
    }
  });

  it("clamps selections and follows active route changes", () => {
    const state: FastHudViewState = {
      mode: "navigation",
      zoomIndex: 99,
      newsIndex: 5,
      todoIndex: 2,
      navigationIndex: 3,
      navigationFollowsActive: true,
    };

    expect(syncFastHudView(state, {
      newsCount: 2,
      todoCount: 1,
      maneuverCount: 3,
      activeManeuverIndex: 2,
    })).toEqual({
      mode: "navigation",
      zoomIndex: FAST_MAP_ZOOM_RADII.length - 1,
      newsIndex: 1,
      todoIndex: 0,
      navigationIndex: 2,
      navigationFollowsActive: true,
    });
    expect(createFastHudViewState().zoomIndex)
      .toBe(FAST_MAP_DEFAULT_ZOOM_INDEX);
  });
});
