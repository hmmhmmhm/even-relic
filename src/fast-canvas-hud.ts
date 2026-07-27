import type { HudPage } from "./canvas-hud";
import type { FastCanvasBattery } from "./glasses";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";

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
const WEEKDAYS = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
] as const;

export const FAST_HUD_PAGES = [
  "overview",
  "news",
  "todo",
  "navigation",
] as const satisfies readonly HudPage[];

export type FastCanvasHudData = {
  readonly battery?: FastCanvasBattery;
  readonly live: LiveDashboardState;
};

export function getAdjacentFastHudPage(
  page: HudPage,
  direction: "next" | "previous",
) {
  const offset = direction === "next" ? 1 : -1;
  const index = FAST_HUD_PAGES.indexOf(page);
  return FAST_HUD_PAGES[
    (index + offset + FAST_HUD_PAGES.length) % FAST_HUD_PAGES.length
  ];
}

function formatTime(now: Date) {
  return [now.getHours(), now.getMinutes()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatDate(now: Date) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join(".");
  return `${date} ${WEEKDAYS[now.getDay()]}`;
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

function mapHeader(live: LiveDashboardState) {
  const source = live.location.value?.source;
  if (source === "live") return "MAP // LIVE";
  if (source === "cache") return "MAP // LAST FIX";
  return "MAP // DEMO";
}

function drawStaticMap(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
) {
  drawFrame(context, 8, 8, 272, 272);
  drawText(context, mapHeader(live), 18, 16, 11, COLOR.secondary, "bold");
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
  drawText(
    context,
    live.map.value?.attribution ?? "© OSM CONTRIBUTORS",
    18,
    238,
    7,
    COLOR.dim,
    "bold",
  );
  drawText(context, "DEST 0.8km", 18, 256, 12, COLOR.primary, "bold");
  drawText(context, "N ↑", 235, 256, 12, COLOR.secondary, "bold");
}

function drawDynamicHeader(
  context: CanvasRenderingContext2D,
  now: Date,
  page: HudPage,
  live: LiveDashboardState,
) {
  drawFrame(context, 296, 8, 272, 54);
  drawText(context, formatTime(now), 306, 12, 22, COLOR.primary, "bold");
  drawText(context, formatDate(now), 306, 40, 10, COLOR.secondary, "bold");
  drawText(
    context,
    weatherSummary(live),
    468,
    40,
    10,
    COLOR.secondary,
    "bold",
  );
  const pageNumber = FAST_HUD_PAGES.indexOf(page) + 1;
  drawText(
    context,
    `${String(pageNumber).padStart(2, "0")} / 04`,
    516,
    18,
    9,
    COLOR.dim,
    "bold",
  );
}

function drawOverview(
  context: CanvasRenderingContext2D,
  data: FastCanvasHudData,
) {
  const { battery, live } = data;
  const batteryText = battery?.level === undefined
    ? "BATTERY --"
    : `${battery.label} ${battery.level}%${battery.charging ? " +" : ""}`;
  drawText(context, "SYSTEM // OVERVIEW", 308, 82, 11, COLOR.secondary, "bold");
  drawText(context, batteryText, 308, 106, 22, COLOR.primary, "bold");
  context.fillStyle = COLOR.dim;
  context.fillRect(308, 140, 248, 1);
  drawText(context, "WEATHER // NOW", 308, 152, 11, COLOR.secondary, "bold");
  drawText(context, weatherSummary(live), 308, 172, 20, COLOR.primary, "bold");

  const weather = usableWeather(live);
  if (weather) {
    drawText(
      context,
      `체감 ${Math.round(weather.apparentTemperature)}°  습도 ${Math.round(weather.humidity)}%`,
      308,
      226,
      11,
      COLOR.secondary,
      "bold",
    );
    drawText(
      context,
      `강수 ${Math.round(weather.precipitationProbability)}%  바람 ${Math.round(weather.windSpeed)}km/h`,
      308,
      248,
      11,
      COLOR.primary,
      "bold",
    );
    if (live.weather.status === "stale") {
      drawText(context, "LAST", 522, 226, 8, COLOR.dim, "bold");
    }
  } else {
    drawText(context, "LIVE DATA UNAVAILABLE", 308, 244, 11, COLOR.dim, "bold");
  }
}

function usableWeather(live: LiveDashboardState) {
  return (live.weather.status === "fresh" || live.weather.status === "stale")
    ? live.weather.value
    : undefined;
}

function weatherSummary(live: LiveDashboardState) {
  const weather = usableWeather(live);
  return weather
    ? `${Math.round(weather.temperature)}°C ${weather.condition}`
    : "WEATHER --";
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
  drawText(context, "· AI 산업 투자 확대", 308, 104, 14, COLOR.primary, "bold");
  drawText(context, "· 도심 자율주행 시범", 308, 128, 14, COLOR.primary, "bold");
  drawText(context, "· 코스피 장중 상승", 308, 152, 14, COLOR.primary, "bold");
  drawText(context, "· 서울 낮 최고 29도", 308, 176, 14, COLOR.primary, "bold");

  drawText(context, "NEWS // MORE", 308, 222, 10, COLOR.secondary, "bold");
  drawText(context, "· 주말 프로야구 빅매치", 308, 237, 13, COLOR.primary, "bold");
  drawText(context, "· 신작 게임 글로벌 출시", 308, 257, 13, COLOR.primary, "bold");
}

function drawTodo(context: CanvasRenderingContext2D) {
  drawText(context, "TODO // ACTIVE", 308, 82, 11, COLOR.secondary, "bold");
  drawCheckbox(context, 308, 108, false);
  drawText(context, "지하철역으로 이동", 332, 103, 18, COLOR.primary, "bold");
  drawCheckbox(context, 308, 150, false);
  drawText(context, "우산 챙기기", 332, 145, 18, COLOR.primary, "bold");
  drawCheckbox(context, 308, 188, true);
  drawText(context, "경로 확인", 332, 183, 16, COLOR.secondary, "bold");

  drawText(context, "PROGRESS // TODAY", 308, 226, 10, COLOR.secondary, "bold");
  drawText(context, "완료 1 / 3", 308, 244, 18, COLOR.primary, "bold");
}

function drawDynamicPage(
  context: CanvasRenderingContext2D,
  page: HudPage,
  data: FastCanvasHudData,
) {
  drawFrame(context, 296, 72, 272, 134);
  drawFrame(context, 296, 216, 272, 64);
  if (page === "overview") drawOverview(context, data);
  if (page === "navigation") drawNavigation(context);
  if (page === "news") drawNews(context);
  if (page === "todo") drawTodo(context);
}

export function drawFastCanvasHud(
  canvas: HTMLCanvasElement,
  now = new Date(),
  page: HudPage = "overview",
  data: FastCanvasHudData = {
    live: createInitialLiveDashboardState(),
  },
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawStaticMap(context, data.live);
  drawDynamicHeader(context, now, page, data.live);
  drawDynamicPage(context, page, data);
}
