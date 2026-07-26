const WIDTH = 576;
const HEIGHT = 288;
const COLOR = {
  background: "#000000",
  primary: "#ffffff",
  secondary: "#aaaaaa",
  dim: "#555555",
} as const;

export const HUD_PAGES = [
  "overview",
  "navigation",
  "news",
  "todo",
] as const;
export type HudPage = typeof HUD_PAGES[number];
export type HudPageDirection = "next" | "previous";

export function getAdjacentHudPage(
  page: HudPage,
  direction: HudPageDirection,
) {
  const offset = direction === "next" ? 1 : -1;
  const index = HUD_PAGES.indexOf(page);
  return HUD_PAGES[(index + offset + HUD_PAGES.length) % HUD_PAGES.length];
}

type HudColor = typeof COLOR[keyof typeof COLOR];
type Point = readonly [number, number];

function formatTime(now: Date) {
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function drawFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: "top-left" | "top-right" = "top-left",
) {
  const corner = 16;
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

  context.fillRect(x + 24, y, 3, 1);
  context.fillRect(right - 27, bottom - 1, 3, 1);

  context.fillStyle = COLOR.primary;
  const accentX = accent === "top-left" ? x : right - 8;
  context.fillRect(accentX, y, 8, 2);
}

function drawFrameIndex(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
) {
  drawText(context, `// ${value}`, x, y, 8, COLOR.dim, "bold");
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

function drawCheckbox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  checked: boolean,
) {
  context.fillStyle = checked ? COLOR.secondary : COLOR.primary;
  context.fillRect(x, y, size, size);
  context.fillStyle = COLOR.background;
  context.fillRect(x + 3, y + 3, size - 6, size - 6);

  if (checked) {
    drawPath(context, [
      [x + 2, y + 5],
      [x + 4, y + 8],
      [x + 9, y + 2],
    ], COLOR.primary, 2);
  }
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

function drawHeader(
  context: CanvasRenderingContext2D,
  now: Date,
  page: HudPage,
) {
  drawFrame(context, 8, 8, 132, 54);
  drawText(context, formatTime(now), 16, 11, 22, COLOR.primary, "bold");
  drawText(context, "HONGDAE  23°C 맑음", 16, 42, 9, COLOR.secondary, "bold");

  drawFrame(context, 148, 8, 276, 54, "top-right");
  drawFrameIndex(context, "AZIMUTH", 156, 47);
  context.fillStyle = COLOR.secondary;
  context.fillRect(156, 29, 260, 1);
  for (let index = 0; index <= 10; index += 1) {
    const x = 160 + index * 25;
    const height = index % 5 === 0 ? 12 : 6;
    context.fillRect(x, 29 - height, 2, height);
  }
  drawText(context, "N", 206, 36, 11, COLOR.secondary);
  drawText(context, "NE 047°", 278, 35, 13, COLOR.primary, "bold");
  drawText(context, "E", 382, 36, 11, COLOR.secondary);

  drawFrame(context, 432, 8, 136, 54);
  drawText(context, "RELIC // LIVE", 440, 13, 10, COLOR.primary, "bold");
  const pageNumber = HUD_PAGES.indexOf(page) + 1;
  drawText(
    context,
    `${String(pageNumber).padStart(2, "0")} / 04`,
    514,
    47,
    8,
    COLOR.dim,
    "bold",
  );
  for (let index = 0; index < 5; index += 1) {
    context.fillStyle = index < 4 ? COLOR.primary : COLOR.dim;
    context.fillRect(442 + index * 13, 49 - index * 5, 8, 3 + index * 5);
  }
}

function drawMap(context: CanvasRenderingContext2D) {
  drawFrame(context, 8, 72, 184, 172);
  drawText(context, "MAP // LOCAL 120m", 16, 78, 9, COLOR.secondary, "bold");
  drawFrameIndex(context, "02", 158, 78);

  const roads: readonly Point[][] = [
    [[18, 98], [58, 90], [98, 110], [180, 94]],
    [[18, 124], [68, 122], [116, 104], [182, 116]],
    [[18, 152], [62, 144], [98, 160], [182, 148]],
    [[18, 184], [58, 174], [106, 190], [182, 180]],
    [[18, 214], [74, 204], [124, 218], [182, 208]],
    [[38, 84], [42, 236]],
    [[82, 78], [74, 238]],
    [[130, 78], [138, 238]],
  ];
  for (const road of roads) drawPath(context, road, COLOR.dim, 1);

  const activeRoute: readonly Point[] = [
    [42, 226],
    [60, 196],
    [102, 184],
    [102, 150],
    [154, 150],
    [154, 110],
  ];
  drawPath(context, activeRoute, COLOR.secondary, 6);
  drawPath(context, activeRoute, COLOR.primary, 2);

  fillPolygon(context, [
    [59, 193],
    [71, 222],
    [59, 216],
    [47, 224],
  ], COLOR.primary);
  context.fillStyle = COLOR.primary;
  context.fillRect(147, 103, 16, 16);
  context.fillStyle = COLOR.background;
  context.fillRect(150, 106, 10, 10);
  context.fillStyle = COLOR.primary;
  context.fillRect(153, 109, 4, 4);

  context.fillStyle = COLOR.dim;
  context.fillRect(12, 112, 5, 1);
  context.fillRect(12, 196, 5, 1);
  context.fillRect(183, 126, 5, 1);
  context.fillRect(183, 210, 5, 1);

  drawFrame(context, 8, 252, 184, 28, "top-right");
  drawText(context, "DEST // 0.8km", 16, 258, 10, COLOR.primary, "bold");
  drawText(context, "N ↑", 151, 258, 10, COLOR.secondary, "bold");
}

function drawNavigation(context: CanvasRenderingContext2D) {
  drawFrame(context, 204, 72, 188, 130, "top-right");
  drawText(context, "NAV // ROUTE 01", 216, 80, 9, COLOR.secondary, "bold");
  drawText(context, "120m", 216, 96, 16, COLOR.primary, "bold");

  const turnRoute: readonly Point[] = [
    [248, 174],
    [248, 130],
    [316, 130],
  ];
  drawPath(context, turnRoute, COLOR.secondary, 8);
  drawPath(context, turnRoute, COLOR.primary, 3);
  drawPath(context, [
    [304, 116],
    [320, 130],
    [304, 144],
  ], COLOR.primary, 3);
  drawText(context, "우회전", 286, 166, 18, COLOR.primary, "bold");

  context.fillStyle = COLOR.dim;
  for (let index = 0; index < 5; index += 1) {
    context.fillRect(376, 92 + index * 16, index === 2 ? 8 : 4, 1);
  }

  drawFrame(context, 204, 214, 188, 66);
  drawText(context, "다음 교차로", 216, 224, 12, COLOR.secondary, "bold");
  drawText(context, "우회전", 216, 242, 22, COLOR.primary, "bold");
  drawText(context, "→", 328, 243, 20, COLOR.primary, "bold");
  drawFrameIndex(context, "03", 356, 262);
}

function drawRightRail(context: CanvasRenderingContext2D) {
  drawFrame(context, 404, 72, 164, 62, "top-right");
  drawText(context, "AUDIO // MIC", 414, 79, 9, COLOR.secondary, "bold");
  drawText(context, "-24 dBFS", 414, 96, 16, COLOR.primary, "bold");
  for (let index = 0; index < 6; index += 1) {
    const height = [8, 18, 28, 20, 14, 10][index];
    context.fillStyle = index < 4 ? COLOR.primary : COLOR.secondary;
    context.fillRect(490 + index * 11, 124 - height, 7, height);
  }
  context.fillStyle = COLOR.dim;
  context.fillRect(414, 125, 142, 1);

  drawFrame(context, 404, 142, 164, 138, "top-right");
  drawText(context, "STATUS // 04", 416, 151, 11, COLOR.primary, "bold");
  drawText(context, "TODO // ACTIVE", 416, 168, 9, COLOR.secondary, "bold");
  drawCheckbox(context, 416, 190, 12, false);
  drawText(context, "지하철역으로", 434, 187, 16, COLOR.primary, "bold");
  drawText(context, "이동", 434, 210, 24, COLOR.primary, "bold");
  drawCheckbox(context, 416, 255, 10, true);
  drawText(context, "경로 확인", 432, 254, 9, COLOR.secondary, "bold");
  drawText(context, "02:14", 520, 254, 9, COLOR.primary, "bold");
}

function drawOverview(context: CanvasRenderingContext2D) {
  drawMap(context);

  drawFrame(context, 204, 72, 188, 130, "top-right");
  drawText(context, "NEWS // LOCAL 01", 216, 80, 9, COLOR.secondary, "bold");
  drawText(context, "2호선 정상 운행", 216, 101, 18, COLOR.primary, "bold");
  context.fillStyle = COLOR.dim;
  context.fillRect(216, 130, 164, 1);
  drawText(context, "홍대입구역 혼잡도", 216, 145, 10, COLOR.secondary, "bold");
  drawText(context, "보통", 216, 164, 22, COLOR.primary, "bold");
  drawFrameIndex(context, "01", 356, 184);

  drawFrame(context, 204, 214, 188, 66);
  drawText(context, "BRIEF // 02", 216, 222, 9, COLOR.secondary, "bold");
  drawText(context, "오늘 23°C · 맑음", 216, 239, 15, COLOR.primary, "bold");
  drawText(context, "강수 10%", 216, 260, 9, COLOR.secondary, "bold");
  drawRightRail(context);
}

function drawNavigationPage(context: CanvasRenderingContext2D) {
  drawMap(context);
  drawNavigation(context);
  drawRightRail(context);
}

function drawNewsPage(context: CanvasRenderingContext2D) {
  drawFrame(context, 8, 72, 384, 130, "top-right");
  drawText(context, "NEWS // FOCUS", 20, 80, 10, COLOR.secondary, "bold");
  drawText(context, "2호선 정상 운행", 20, 103, 28, COLOR.primary, "bold");
  drawText(context, "홍대입구역 혼잡도 보통", 20, 145, 16, COLOR.primary, "bold");
  drawText(context, "16:31  ·  LOCAL TRANSIT", 20, 178, 9, COLOR.dim, "bold");
  drawFrameIndex(context, "01", 354, 184);

  drawFrame(context, 8, 214, 384, 66);
  drawText(context, "WEATHER // HONGDAE", 20, 222, 9, COLOR.secondary, "bold");
  drawText(context, "오늘 23°C · 맑음", 20, 240, 17, COLOR.primary, "bold");
  drawText(context, "강수 확률 10%", 242, 244, 11, COLOR.secondary, "bold");

  drawFrame(context, 404, 72, 164, 96);
  drawText(context, "UP NEXT // 02", 416, 80, 9, COLOR.secondary, "bold");
  drawText(context, "기온 변화 없음", 416, 101, 15, COLOR.primary, "bold");
  drawText(context, "18:00까지", 416, 130, 10, COLOR.secondary, "bold");

  drawFrame(context, 404, 180, 164, 100, "top-right");
  drawText(context, "SIGNAL // LIVE", 416, 188, 9, COLOR.secondary, "bold");
  drawText(context, "NEWS  03", 416, 209, 18, COLOR.primary, "bold");
  drawText(context, "LAST  00:12", 416, 248, 9, COLOR.dim, "bold");
}

function drawTodoPage(context: CanvasRenderingContext2D) {
  drawFrame(context, 8, 72, 384, 208, "top-right");
  drawText(context, "TODO // FOCUS", 20, 80, 10, COLOR.secondary, "bold");
  drawCheckbox(context, 20, 106, 14, false);
  drawText(context, "지하철역으로 이동", 44, 101, 21, COLOR.primary, "bold");
  drawText(context, "NEXT  ·  0.8km", 44, 128, 9, COLOR.dim, "bold");
  drawCheckbox(context, 20, 158, 14, false);
  drawText(context, "우산 챙기기", 44, 153, 21, COLOR.primary, "bold");
  drawText(context, "강수 확률 10%", 44, 180, 9, COLOR.dim, "bold");
  drawCheckbox(context, 20, 214, 14, true);
  drawText(context, "경로 확인", 44, 209, 21, COLOR.secondary, "bold");
  drawText(context, "DONE  ·  02:14", 44, 238, 9, COLOR.dim, "bold");

  drawFrame(context, 404, 72, 164, 96);
  drawText(context, "AUDIO // STATUS", 416, 80, 9, COLOR.secondary, "bold");
  drawText(context, "-24 dBFS", 416, 102, 20, COLOR.primary, "bold");
  context.fillStyle = COLOR.primary;
  context.fillRect(416, 140, 104, 2);
  context.fillStyle = COLOR.dim;
  context.fillRect(520, 140, 36, 2);

  drawFrame(context, 404, 180, 164, 100, "top-right");
  drawText(context, "LINK // G2 + R1", 416, 188, 9, COLOR.secondary, "bold");
  drawText(context, "CONNECTED", 416, 211, 16, COLOR.primary, "bold");
  drawText(context, "SCROLL READY", 416, 248, 9, COLOR.dim, "bold");
}

export function drawDenseCanvasHud(
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

  drawHeader(context, now, page);
  if (page === "overview") drawOverview(context);
  if (page === "navigation") drawNavigationPage(context);
  if (page === "news") drawNewsPage(context);
  if (page === "todo") drawTodoPage(context);
}
