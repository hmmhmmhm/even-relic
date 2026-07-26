import { HUD_PAGES, type HudPage } from "./canvas-hud";

const COLOR = {
  background: "#000000",
  primary: "#ffffff",
  secondary: "#aaaaaa",
  dim: "#555555",
} as const;
type Point = readonly [number, number];

const HYBRID_PAGE_LINES: Record<HudPage, readonly string[]> = {
  overview: [
    "NEWS // OVERVIEW",
    "2호선 정상 운행",
    "홍대입구역 혼잡도 보통",
    "[ ] 지하철역으로 이동",
    "MIC -24 dBFS",
  ],
  navigation: [
    "NAVIGATION // ACTIVE",
    "NEXT 120m   DEST 0.8km",
    "우회전 →",
    "다음 교차로에서",
    "우회전",
  ],
  news: [
    "NEWS // FOCUS",
    "2호선 정상 운행",
    "홍대입구역 혼잡도 보통",
    "오늘 23°C · 맑음",
    "강수 확률 10%",
  ],
  todo: [
    "TODO // FOCUS",
    "[ ] 지하철역으로 이동",
    "[ ] 우산 챙기기",
    "[x] 경로 확인",
    "G2 + R1 CONNECTED",
  ],
};

function drawPath(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: string,
  width: number,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function drawCornerFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const corner = 14;
  context.fillStyle = COLOR.dim;
  context.fillRect(x, y, corner, 1);
  context.fillRect(x, y, 1, corner);
  context.fillRect(x + width - corner, y, corner, 1);
  context.fillRect(x + width - 1, y, 1, corner);
  context.fillRect(x, y + height - 1, corner, 1);
  context.fillRect(x, y + height - corner, 1, corner);
  context.fillRect(x + width - corner, y + height - 1, corner, 1);
  context.fillRect(x + width - 1, y + height - corner, 1, corner);
}

export function drawHybridHudBackground(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");
  canvas.width = 576;
  canvas.height = 288;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, 576, 288);

  context.fillStyle = COLOR.dim;
  context.fillRect(0, 63, 576, 1);
  context.fillRect(195, 64, 1, 224);
  context.fillRect(401, 64, 1, 224);
  context.fillRect(196, 207, 380, 1);
  drawCornerFrame(context, 8, 8, 560, 46);
  drawCornerFrame(context, 8, 72, 180, 208);
  drawCornerFrame(context, 204, 72, 188, 128);
  drawCornerFrame(context, 410, 72, 158, 128);
  drawCornerFrame(context, 204, 216, 364, 64);

  const roads: readonly Point[][] = [
    [[18, 96], [62, 88], [106, 108], [180, 94]],
    [[18, 126], [72, 122], [116, 103], [180, 117]],
    [[18, 158], [64, 146], [104, 162], [180, 148]],
    [[18, 190], [60, 176], [112, 194], [180, 180]],
    [[18, 224], [76, 206], [126, 222], [180, 208]],
    [[42, 78], [44, 272]],
    [[88, 78], [80, 272]],
    [[138, 78], [144, 272]],
  ];
  for (const road of roads) drawPath(context, road, COLOR.dim, 1);
  drawPath(context, [
    [42, 258],
    [62, 218],
    [108, 204],
    [108, 166],
    [156, 166],
    [156, 118],
  ], COLOR.secondary, 6);
  drawPath(context, [
    [42, 258],
    [62, 218],
    [108, 204],
    [108, 166],
    [156, 166],
    [156, 118],
  ], COLOR.primary, 2);

  context.fillStyle = COLOR.secondary;
  context.fillRect(16, 16, 42, 2);
  context.fillRect(212, 80, 26, 2);
  context.fillRect(418, 80, 26, 2);
  context.fillStyle = COLOR.primary;
  context.fillRect(8, 8, 12, 2);
  context.fillRect(556, 278, 12, 2);
}

export function formatHybridHudText(
  page: HudPage,
  now = new Date(),
) {
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
  const pageNumber = String(HUD_PAGES.indexOf(page) + 1).padStart(2, "0");
  return [
    `${time}  23°C 맑음  ${pageNumber} / 04`,
    "RELIC // LIVE   HONGDAE",
    "",
    ...HYBRID_PAGE_LINES[page],
  ].join("\n");
}
