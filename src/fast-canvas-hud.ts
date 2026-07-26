import { HUD_PAGES, type HudPage } from "./canvas-hud";

const WIDTH = 576;
const HEIGHT = 288;
const COLOR = {
  background: "#000000",
  primary: "#ffffff",
  secondary: "#d0d0d0",
  dim: "#808080",
} as const;

type HudColor = typeof COLOR[keyof typeof COLOR];
type Point = readonly [number, number];

function formatTime(now: Date) {
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: HudColor = COLOR.primary,
  weight: "normal" | "bold" = "normal",
) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px "SFMono-Regular", Consolas, monospace`;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(value, x, y);
}

function drawPath(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
  width: number,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "square";
  context.lineJoin = "miter";
  context.stroke();
}

function drawFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const corner = 18;
  const right = x + width;
  const bottom = y + height;
  context.fillStyle = COLOR.dim;
  context.fillRect(x, y, corner, 1);
  context.fillRect(x, y, 1, corner);
  context.fillRect(right - corner, y, corner, 1);
  context.fillRect(right - 1, y, 1, corner);
  context.fillRect(x, bottom - 1, corner, 1);
  context.fillRect(x, bottom - corner, 1, corner);
  context.fillRect(right - corner, bottom - 1, corner, 1);
  context.fillRect(right - 1, bottom - corner, 1, corner);
  context.fillStyle = COLOR.primary;
  context.fillRect(x, y, 10, 2);
}

function fillPolygon(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawCheckbox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  checked: boolean,
) {
  context.fillStyle = checked ? COLOR.secondary : COLOR.primary;
  context.fillRect(x, y, 14, 14);
  context.fillStyle = COLOR.background;
  context.fillRect(x + 3, y + 3, 8, 8);
  if (checked) {
    drawPath(context, [
      [x + 2, y + 7],
      [x + 6, y + 11],
      [x + 13, y + 2],
    ], COLOR.primary, 2);
  }
}

function drawStaticMap(context: CanvasRenderingContext2D) {
  drawFrame(context, 8, 8, 272, 272);
  drawText(context, "MAP // HONGDAE", 18, 16, 11, COLOR.secondary, "bold");
  drawText(context, "RELIC // LOCAL", 170, 16, 9, COLOR.dim, "bold");

  const roads: readonly Point[][] = [
    [[18, 52], [78, 42], [130, 64], [202, 48], [270, 62]],
    [[18, 88], [68, 82], [126, 94], [190, 78], [270, 90]],
    [[18, 126], [76, 114], [134, 132], [198, 118], [270, 128]],
    [[18, 166], [62, 152], [126, 172], [202, 154], [270, 166]],
    [[18, 208], [82, 192], [144, 214], [214, 198], [270, 208]],
    [[46, 34], [52, 244]],
    [[108, 34], [98, 246]],
    [[172, 34], [182, 246]],
    [[234, 34], [226, 246]],
  ];
  for (const road of roads) drawPath(context, road, COLOR.dim, 1);

  const activeRoute: readonly Point[] = [
    [42, 232],
    [72, 192],
    [128, 176],
    [128, 132],
    [196, 132],
    [196, 78],
    [246, 78],
  ];
  drawPath(context, activeRoute, COLOR.secondary, 8);
  drawPath(context, activeRoute, COLOR.primary, 3);
  fillPolygon(context, [
    [68, 190],
    [82, 222],
    [68, 215],
    [54, 224],
  ], COLOR.primary);

  context.fillStyle = COLOR.primary;
  context.fillRect(238, 70, 18, 18);
  context.fillStyle = COLOR.background;
  context.fillRect(242, 74, 10, 10);
  context.fillStyle = COLOR.primary;
  context.fillRect(245, 77, 4, 4);

  context.fillStyle = COLOR.background;
  context.fillRect(12, 250, 264, 25);
  context.fillStyle = COLOR.dim;
  context.fillRect(12, 249, 264, 1);
  drawText(context, "DEST 0.8km", 18, 256, 12, COLOR.primary, "bold");
  drawText(context, "N ↑", 235, 256, 12, COLOR.secondary, "bold");
}

function drawDynamicHeader(
  context: CanvasRenderingContext2D,
  now: Date,
  page: HudPage,
) {
  drawFrame(context, 296, 8, 272, 54);
  drawText(context, formatTime(now), 306, 12, 22, COLOR.primary, "bold");
  drawText(context, "HONGDAE  23°C 맑음", 306, 40, 10, COLOR.secondary, "bold");
  const pageNumber = HUD_PAGES.indexOf(page) + 1;
  drawText(
    context,
    `${String(pageNumber).padStart(2, "0")} / 04`,
    516,
    42,
    9,
    COLOR.dim,
    "bold",
  );
}

function drawOverview(context: CanvasRenderingContext2D) {
  drawText(context, "NEWS // OVERVIEW", 308, 82, 11, COLOR.secondary, "bold");
  drawText(context, "2호선 정상 운행", 308, 106, 22, COLOR.primary, "bold");
  context.fillStyle = COLOR.dim;
  context.fillRect(308, 140, 248, 1);
  drawText(context, "홍대입구역", 308, 152, 12, COLOR.secondary, "bold");
  drawText(context, "혼잡도  보통", 308, 170, 20, COLOR.primary, "bold");

  drawText(context, "STATUS // NOW", 308, 226, 10, COLOR.secondary, "bold");
  drawText(context, "TODO  01", 308, 244, 18, COLOR.primary, "bold");
  drawText(context, "MIC -24", 474, 249, 10, COLOR.dim, "bold");
}

function drawNavigation(context: CanvasRenderingContext2D) {
  drawText(context, "NAV // ACTIVE", 308, 82, 11, COLOR.secondary, "bold");
  drawText(context, "120m", 308, 104, 28, COLOR.primary, "bold");
  drawPath(context, [
    [330, 184],
    [330, 146],
    [418, 146],
  ], COLOR.secondary, 10);
  drawPath(context, [
    [330, 184],
    [330, 146],
    [418, 146],
  ], COLOR.primary, 4);
  drawPath(context, [
    [404, 132],
    [420, 146],
    [404, 160],
  ], COLOR.primary, 4);
  drawText(context, "우회전", 444, 137, 24, COLOR.primary, "bold");

  drawText(context, "NEXT // INTERSECTION", 308, 226, 10, COLOR.secondary, "bold");
  drawText(context, "다음 교차로", 308, 244, 18, COLOR.primary, "bold");
}

function drawNews(context: CanvasRenderingContext2D) {
  drawText(context, "NEWS // FOCUS", 308, 82, 11, COLOR.secondary, "bold");
  drawText(context, "2호선 정상 운행", 308, 106, 22, COLOR.primary, "bold");
  drawText(context, "홍대입구역  보통", 308, 146, 18, COLOR.primary, "bold");
  drawText(context, "LOCAL TRANSIT  16:31", 308, 181, 10, COLOR.dim, "bold");

  drawText(context, "WEATHER // HONGDAE", 308, 226, 10, COLOR.secondary, "bold");
  drawText(context, "23°C  맑음", 308, 244, 18, COLOR.primary, "bold");
  drawText(context, "강수 10%", 486, 249, 10, COLOR.dim, "bold");
}

function drawTodo(context: CanvasRenderingContext2D) {
  drawText(context, "TODO // ACTIVE", 308, 82, 11, COLOR.secondary, "bold");
  drawCheckbox(context, 308, 108, false);
  drawText(context, "지하철역으로 이동", 332, 103, 18, COLOR.primary, "bold");
  drawCheckbox(context, 308, 150, false);
  drawText(context, "우산 챙기기", 332, 145, 18, COLOR.primary, "bold");
  drawCheckbox(context, 308, 188, true);
  drawText(context, "경로 확인", 332, 183, 16, COLOR.secondary, "bold");

  drawText(context, "LINK // G2 + R1", 308, 226, 10, COLOR.secondary, "bold");
  drawText(context, "CONNECTED", 308, 244, 18, COLOR.primary, "bold");
}

function drawDynamicPage(
  context: CanvasRenderingContext2D,
  page: HudPage,
) {
  drawFrame(context, 296, 72, 272, 134);
  drawFrame(context, 296, 216, 272, 64);
  if (page === "overview") drawOverview(context);
  if (page === "navigation") drawNavigation(context);
  if (page === "news") drawNews(context);
  if (page === "todo") drawTodo(context);
}

export function drawFastCanvasHud(
  canvas: HTMLCanvasElement,
  now = new Date(),
  page: HudPage = "overview",
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawStaticMap(context);
  drawDynamicHeader(context, now, page);
  drawDynamicPage(context, page);
}
