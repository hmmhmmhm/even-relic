import { FAST_CANVAS_COLOR as COLOR } from "./fast-canvas-style";

export type FastWeatherIconKind =
  | "sun"
  | "partly-cloudy"
  | "cloud"
  | "fog"
  | "rain"
  | "snow"
  | "thunder";

type UnitPoint = readonly [number, number];

export function weatherIconKind(code: number): FastWeatherIconKind {
  if (code === 0) return "sun";
  if (code <= 2) return "partly-cloudy";
  if (code === 3) return "cloud";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  if (code <= 86) return "snow";
  return "thunder";
}

function project(
  point: UnitPoint,
  x: number,
  y: number,
  size: number,
): [number, number] {
  return [x + point[0] * size, y + point[1] * size];
}

function strokePath(
  context: CanvasRenderingContext2D,
  points: readonly UnitPoint[],
  x: number,
  y: number,
  size: number,
  width = 0.045,
  close = false,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...project(first, x, y, size));
  for (const point of rest) {
    context.lineTo(...project(point, x, y, size));
  }
  if (close) context.closePath();
  context.strokeStyle = COLOR.primary;
  context.lineWidth = Math.max(2, Math.round(size * width));
  context.lineCap = "square";
  context.lineJoin = "miter";
  context.stroke();
}

function fillPath(
  context: CanvasRenderingContext2D,
  points: readonly UnitPoint[],
  x: number,
  y: number,
  size: number,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...project(first, x, y, size));
  for (const point of rest) {
    context.lineTo(...project(point, x, y, size));
  }
  context.closePath();
  context.fillStyle = COLOR.primary;
  context.fill();
}

function drawSun(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  center: UnitPoint = [0.5, 0.48],
  radius = 0.19,
) {
  const [cx, cy] = center;
  const ring = Array.from({ length: 8 }, (_, index): UnitPoint => {
    const angle = Math.PI / 8 + index * Math.PI / 4;
    return [
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
    ];
  });
  strokePath(context, ring, x, y, size, 0.05, true);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    strokePath(context, [
      [
        cx + Math.cos(angle) * (radius + 0.08),
        cy + Math.sin(angle) * (radius + 0.08),
      ],
      [
        cx + Math.cos(angle) * (radius + 0.18),
        cy + Math.sin(angle) * (radius + 0.18),
      ],
    ], x, y, size, 0.035);
  }
}

function drawCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  strokePath(context, [
    [0.12, 0.68],
    [0.12, 0.56],
    [0.24, 0.48],
    [0.34, 0.48],
    [0.38, 0.34],
    [0.50, 0.27],
    [0.64, 0.34],
    [0.69, 0.48],
    [0.82, 0.48],
    [0.90, 0.57],
    [0.88, 0.68],
    [0.12, 0.68],
  ], x, y, size, 0.05, true);
}

function drawFog(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  drawCloud(context, x, y - size * 0.09, size);
  strokePath(context, [[0.16, 0.76], [0.76, 0.76]], x, y, size, 0.035);
  strokePath(context, [[0.28, 0.88], [0.88, 0.88]], x, y, size, 0.035);
}

function drawRain(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  drawCloud(context, x, y - size * 0.12, size);
  for (const startX of [0.30, 0.50, 0.70]) {
    strokePath(context, [
      [startX + 0.06, 0.67],
      [startX - 0.04, 0.88],
    ], x, y, size, 0.045);
  }
}

function drawSnow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  drawCloud(context, x, y - size * 0.13, size);
  for (const centerX of [0.28, 0.50, 0.72]) {
    strokePath(context, [
      [centerX, 0.68],
      [centerX, 0.88],
    ], x, y, size, 0.03);
    strokePath(context, [
      [centerX - 0.08, 0.78],
      [centerX + 0.08, 0.78],
    ], x, y, size, 0.03);
  }
}

function drawThunder(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  drawCloud(context, x, y - size * 0.13, size);
  fillPath(context, [
    [0.48, 0.61],
    [0.66, 0.61],
    [0.56, 0.75],
    [0.67, 0.75],
    [0.39, 0.94],
    [0.46, 0.79],
    [0.36, 0.79],
  ], x, y, size);
}

export function drawFastWeatherIcon(
  context: CanvasRenderingContext2D,
  code: number,
  x: number,
  y: number,
  size: number,
) {
  const kind = weatherIconKind(code);
  if (kind === "sun") {
    drawSun(context, x, y, size);
  } else if (kind === "partly-cloudy") {
    drawSun(context, x, y, size, [0.34, 0.32], 0.12);
    drawCloud(context, x, y + size * 0.08, size);
  } else if (kind === "cloud") {
    drawCloud(context, x, y, size);
  } else if (kind === "fog") {
    drawFog(context, x, y, size);
  } else if (kind === "rain") {
    drawRain(context, x, y, size);
  } else if (kind === "snow") {
    drawSnow(context, x, y, size);
  } else {
    drawThunder(context, x, y, size);
  }
}
