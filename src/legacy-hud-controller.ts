import hudReferenceUrl from "../docs/design/selected-peripheral-focus.png";
import { drawCalibrationPattern } from "./calibration";
import { getAdjacentHudPage, HUD_PAGES, type HudPage } from "./canvas-hud";
import {
  drawHudReference,
  transmitCanvas,
  transmitHardwareBmp,
  transmitHybridCanvas,
  transmitLayeredHybridCanvas,
  transmitOfficialSample,
} from "./glasses";
import {
  drawHybridHudBackground,
  drawLayeredHybridHudBackground,
  formatHybridHudText,
} from "./hybrid-hud";

export type LegacyHudModes = {
  readonly calibration: boolean;
  readonly canvas: boolean;
  readonly diagnostic: boolean;
  readonly hardwareBmp: boolean;
  readonly hybrid: boolean;
  readonly layeredHybrid: boolean;
  readonly legacyCanvas: boolean;
};

export async function prepareInitialHud(
  canvas: HTMLCanvasElement,
  modes: LegacyHudModes,
  drawCanvas: () => void,
) {
  if (modes.calibration) {
    drawCalibrationPattern(canvas);
  } else if (modes.canvas) {
    drawCanvas();
  } else if (modes.hybrid) {
    if (modes.layeredHybrid) drawLayeredHybridHudBackground(canvas);
    else drawHybridHudBackground(canvas);
  } else {
    await drawHudReference(canvas, hudReferenceUrl);
  }
}

export async function transmitLegacyHud(
  canvas: HTMLCanvasElement,
  modes: LegacyHudModes,
  report: (message: string) => void,
  navigateCanvas: (direction: "next" | "previous") => Promise<void>,
) {
  if (modes.hardwareBmp) return transmitHardwareBmp(report);
  if (modes.diagnostic) return transmitOfficialSample(report);
  if (!modes.hybrid) {
    return transmitCanvas(
      canvas,
      report,
      undefined,
      undefined,
      modes.legacyCanvas ? navigateCanvas : undefined,
    );
  }

  let page: HudPage = HUD_PAGES[0];
  const transmit = modes.layeredHybrid
    ? transmitLayeredHybridCanvas
    : transmitHybridCanvas;
  return transmit(
    canvas,
    formatHybridHudText(page),
    report,
    async (direction) => {
      page = getAdjacentHudPage(page, direction);
      return formatHybridHudText(page);
    },
  );
}
