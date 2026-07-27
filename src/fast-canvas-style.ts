export const FAST_CANVAS_COLOR = {
  background: "#000000",
  primary: "#ffffff",
  secondary: "#d0d0d0",
  dim: "#808080",
} as const;

export type FastCanvasColor =
  typeof FAST_CANVAS_COLOR[keyof typeof FAST_CANVAS_COLOR];
export type FastCanvasPoint = readonly [number, number];

export function drawFastCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: FastCanvasColor = FAST_CANVAS_COLOR.primary,
  weight: "normal" | "bold" = "normal",
) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px "SFMono-Regular", Consolas, monospace`;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(value, x, y);
}

export function drawFastCanvasPath(
  context: CanvasRenderingContext2D,
  points: readonly FastCanvasPoint[],
  color: FastCanvasColor,
  width: number,
) {
  const [first, ...rest] = points;
  if (!first || rest.length === 0) return;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "square";
  context.lineJoin = "miter";
  context.stroke();
}
