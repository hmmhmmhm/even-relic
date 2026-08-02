import { describe, expect, it } from "vitest";
import { resolveHudModeResolution } from "./hud-mode-resolution";

describe("resolveHudModeResolution", () => {
  it("resolves the shipped fast Canvas route", () => {
    expect(resolveHudModeResolution("/hud-canvas-fast", "")).toMatchObject({
      canvasHudMode: true,
      fastCanvasHudMode: true,
      diagnosticMode: false,
      modes: {
        canvas: true,
        fastCanvas: true,
        legacyCanvas: false,
      },
    });
  });

  it("retains legacy, layered hybrid, and query diagnostics", () => {
    expect(resolveHudModeResolution("/hud-canvas", "").modes)
      .toMatchObject({ canvas: true, legacyCanvas: true });
    expect(resolveHudModeResolution("/hud-hybrid-z", "").modes)
      .toMatchObject({ hybrid: true, layeredHybrid: true });
    expect(resolveHudModeResolution("/", "?mode=diagnostic").modes.diagnostic)
      .toBe(true);
  });
});
