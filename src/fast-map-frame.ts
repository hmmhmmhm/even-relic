import {
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";

export function drawFullscreenMapHeader(
  context: CanvasRenderingContext2D,
  source: string,
  layer: string,
  radiusMeters: number,
) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, 576, 31);
  context.fillStyle = COLOR.dim;
  context.fillRect(0, 30, 576, 1);
  drawText(
    context,
    `MAP // ${source} · ${layer}`,
    14,
    8,
    12,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    `ZOOM // ${radiusMeters}m`,
    444,
    8,
    12,
    COLOR.secondary,
    "bold",
  );
}

export function drawFullscreenMapFooter(
  context: CanvasRenderingContext2D,
) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 254, 576, 34);
  context.fillStyle = COLOR.dim;
  context.fillRect(0, 253, 576, 1);
  drawText(
    context,
    "© OSM CONTRIBUTORS",
    14,
    264,
    9,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    "DOUBLE TAP // BACK",
    400,
    264,
    9,
    COLOR.primary,
    "bold",
  );
}
