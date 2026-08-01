import { describe, expect, it, vi } from "vitest";
import { createFastHudInputController } from "./fast-hud-input-controller";
import { createFastHudViewState } from "./fast-hud-view";

describe("fast HUD native Ask AI input flow", () => {
  it("enters one native page, updates it for history, and restores Canvas", async () => {
    let view = createFastHudViewState();
    let nativeActive = false;
    const native = {
      active: vi.fn(() => nativeActive),
      enter: vi.fn(async () => {
        nativeActive = true;
        return true;
      }),
      update: vi.fn(async () => true),
      restore: vi.fn(async () => {
        nativeActive = false;
        return true;
      }),
    };
    const ai = {
      start: vi.fn(async () => true),
      toggle: vi.fn(async () => true),
      stop: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    const draw = vi.fn();
    const input = createFastHudInputController({
      getView: () => view,
      setView: (next) => { view = next; },
      getPage: () => "ai",
      getContext: () => ({
        newsCount: 0,
        newsPageCounts: [],
        todoCount: 0,
        maneuverCount: 0,
        activeManeuverIndex: 0,
        aiPageCount: 2,
      }),
      getLiveSession: () => undefined,
      getAiRuntime: () => ai,
      getNativeText: () => native,
      nativeContent: () => `PAGE ${view.aiPage}`,
      drawCurrentPage: draw,
    });

    expect(await input("tap")).toBe("consume");
    expect(view.mode).toBe("ai");
    expect(native.enter).toHaveBeenCalledWith("PAGE 1");
    expect(ai.start).toHaveBeenCalledOnce();
    expect(draw).not.toHaveBeenCalled();

    expect(await input("scroll-previous")).toBe("consume");
    expect(view.aiPage).toBe(0);
    expect(native.update).toHaveBeenCalledWith("PAGE 0");

    expect(await input("double-tap")).toBe("consume");
    expect(view.mode).toBe("dashboard");
    expect(ai.stop).toHaveBeenCalledOnce();
    expect(draw).toHaveBeenCalledOnce();
    expect(native.restore).toHaveBeenCalledOnce();
  });

  it("does not start the microphone when the native page cannot open", async () => {
    let view = createFastHudViewState();
    const start = vi.fn(async () => true);
    const input = createFastHudInputController({
      getView: () => view,
      setView: (next) => { view = next; },
      getPage: () => "ai",
      getContext: () => ({
        newsCount: 0,
        newsPageCounts: [],
        todoCount: 0,
        maneuverCount: 0,
        activeManeuverIndex: 0,
        aiPageCount: 1,
      }),
      getLiveSession: () => undefined,
      getAiRuntime: () => ({
        start,
        toggle: async () => false,
        stop: async () => undefined,
        dispose: () => undefined,
      }),
      getNativeText: () => ({
        active: () => false,
        enter: async () => false,
        update: async () => false,
        restore: async () => false,
      }),
      nativeContent: () => "ASK AI",
      drawCurrentPage: () => undefined,
    });

    expect(await input("tap")).toBe("consume");
    expect(view.mode).toBe("dashboard");
    expect(start).not.toHaveBeenCalled();
  });
});
