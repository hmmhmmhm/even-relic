import type { HudControllerModes } from "./hud-controller-types";

export type HudModeResolution = {
  readonly calibrationMode: boolean;
  readonly canvasHudMode: boolean;
  readonly diagnosticMode: boolean;
  readonly fastCanvasHudMode: boolean;
  readonly hardwareBmpMode: boolean;
  readonly hybridHudMode: boolean;
  readonly layeredHybridHudMode: boolean;
  readonly legacyCanvasHudMode: boolean;
  readonly modes: HudControllerModes;
};

export function resolveHudModeResolution(
  pathname: string,
  search: string,
): HudModeResolution {
  const calibrationMode = pathname === "/calibration-max";
  const legacyCanvasHudMode = pathname === "/hud-canvas";
  const fastCanvasHudMode = pathname === "/hud-canvas-fast";
  const canvasHudMode = legacyCanvasHudMode || fastCanvasHudMode;
  const legacyHybridHudMode = pathname === "/hud-hybrid";
  const layeredHybridHudMode = pathname === "/hud-hybrid-z";
  const hybridHudMode = legacyHybridHudMode || layeredHybridHudMode;
  const hardwareBmpMode = pathname === "/diagnostic-v10";
  const diagnosticMode = pathname.startsWith("/diagnostic-v")
    || new URLSearchParams(search).get("mode") === "diagnostic";
  return {
    calibrationMode,
    canvasHudMode,
    diagnosticMode,
    fastCanvasHudMode,
    hardwareBmpMode,
    hybridHudMode,
    layeredHybridHudMode,
    legacyCanvasHudMode,
    modes: {
      calibration: calibrationMode,
      canvas: canvasHudMode,
      diagnostic: diagnosticMode,
      fastCanvas: fastCanvasHudMode,
      hardwareBmp: hardwareBmpMode,
      hybrid: hybridHudMode,
      layeredHybrid: layeredHybridHudMode,
      legacyCanvas: legacyCanvasHudMode,
    },
  };
}
