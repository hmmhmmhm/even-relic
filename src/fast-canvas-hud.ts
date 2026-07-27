import type { HudPage } from "./canvas-hud";
import type { FastCanvasBattery } from "./glasses";
import { drawFastMap } from "./fast-map";
import {
  createInitialLiveDashboardState,
  type DataState,
  type LiveDashboardState,
  type RouteValue,
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
  readonly mapRadiusMeters?: number;
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

function drawRouteDestination(
  context: CanvasRenderingContext2D,
  route: RouteValue,
) {
  drawText(
    context,
    `DEST // ${truncateHudTitle(route.destinationName, 18)}`,
    308,
    226,
    10,
    COLOR.secondary,
    "bold",
  );
  const profile = route.profile === "foot-walking"
    ? "도보"
    : route.profile === "cycling-regular"
      ? "자전거"
      : "자동차";
  drawText(context, `MODE // ${profile}`, 308, 246, 15, COLOR.primary, "bold");
}

function formatRouteDistance(distance: number) {
  const rounded = Math.max(0, Math.round(distance));
  return rounded >= 1_000
    ? `${(rounded / 1_000).toFixed(1)}km`
    : `${rounded}m`;
}

function drawNavigation(
  context: CanvasRenderingContext2D,
  routeState: DataState<RouteValue>,
) {
  if (routeState.status === "disabled") {
    drawText(context, "NAV // READY", 308, 82, 11, COLOR.secondary, "bold");
    drawText(context, "경로 키 필요", 308, 108, 24, COLOR.primary, "bold");
    drawText(context, "ORS 연결 후 사용", 308, 150, 15, COLOR.secondary, "bold");
    drawText(context, "PHONE // COMPANION", 308, 226, 10, COLOR.secondary, "bold");
    drawText(context, "키 설정 필요", 308, 246, 15, COLOR.primary, "bold");
    return;
  }

  if (routeState.status === "loading") {
    drawText(context, "NAV // ROUTING", 308, 82, 11, COLOR.secondary, "bold");
    drawText(context, "경로 계산 중", 308, 108, 24, COLOR.primary, "bold");
    drawText(context, "목적지까지 경로 확인", 308, 150, 14, COLOR.secondary, "bold");
    drawText(context, "ORS // WORKING", 308, 226, 10, COLOR.secondary, "bold");
    drawText(context, "잠시만 기다려주세요", 308, 246, 14, COLOR.primary, "bold");
    return;
  }

  const route = routeState.value;
  if (!route) {
    drawText(context, "NAV // READY", 308, 82, 11, COLOR.secondary, "bold");
    drawText(context, "목적지를 선택하세요", 308, 108, 20, COLOR.primary, "bold");
    drawText(context, "폰 화면에서 검색", 308, 150, 15, COLOR.secondary, "bold");
    drawText(context, "PHONE // COMPANION", 308, 226, 10, COLOR.secondary, "bold");
    drawText(context, "도보 · 자전거 · 자동차", 308, 246, 13, COLOR.primary, "bold");
    return;
  }

  if (routeState.status === "stale") {
    const instruction = route.maneuvers[route.activeManeuverIndex]?.instruction;
    drawText(context, "NAV // STALE", 308, 82, 11, COLOR.secondary, "bold");
    drawText(context, "경로 확인 필요", 308, 108, 23, COLOR.primary, "bold");
    if (instruction) {
      drawText(
        context,
        truncateHudTitle(instruction, 22),
        308,
        154,
        15,
        COLOR.secondary,
        "bold",
      );
    }
    drawRouteDestination(context, route);
    return;
  }

  const instruction = route.maneuvers[route.activeManeuverIndex]?.instruction
    ?? "목적지 도착";
  drawText(context, "NAV // ACTIVE", 308, 82, 11, COLOR.secondary, "bold");
  drawText(
    context,
    formatRouteDistance(route.remainingDistance),
    308,
    104,
    28,
    COLOR.primary,
    "bold",
  );
  drawPath(context, [
    [330, 184],
    [330, 146],
    [408, 146],
  ], COLOR.secondary, 10);
  drawPath(context, [
    [330, 184],
    [330, 146],
    [408, 146],
  ], COLOR.primary, 4);
  drawPath(context, [
    [394, 132],
    [410, 146],
    [394, 160],
  ], COLOR.primary, 4);
  drawText(
    context,
    truncateHudTitle(instruction, 18),
    420,
    137,
    18,
    COLOR.primary,
    "bold",
  );
  drawRouteDestination(context, route);
}

function hudUnits(value: string): number {
  return [...value].reduce(
    (total, character) =>
      total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2),
    0,
  );
}

export function truncateHudTitle(title: string, maxUnits: number): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (hudUnits(normalized) <= maxUnits) return normalized;
  const ellipsisUnits = 2;
  let output = "";
  let used = 0;
  for (const character of normalized) {
    const units = /^[\x00-\x7F]$/.test(character) ? 1 : 2;
    if (used + units + ellipsisUnits > maxUnits) break;
    output += character;
    used += units;
  }
  return `${output.trimEnd()}…`;
}

function drawNews(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
) {
  const stale = live.news.status === "stale";
  const items = live.news.status === "fresh" || stale
    ? live.news.value ?? []
    : [];
  drawText(
    context,
    stale ? "NEWS // FOCUS · STALE" : "NEWS // FOCUS",
    308,
    82,
    11,
    COLOR.secondary,
    "bold",
  );
  if (items.length === 0) {
    drawText(
      context,
      live.news.status === "loading" ? "NEWS LOADING" : "NEWS UNAVAILABLE",
      308,
      112,
      16,
      COLOR.primary,
      "bold",
    );
    return;
  }

  const positions = [
    [308, 104, 14, 25],
    [308, 128, 14, 25],
    [308, 152, 14, 25],
    [308, 176, 14, 25],
    [308, 237, 13, 29],
    [308, 257, 13, 29],
  ] as const;
  items.slice(0, 6).forEach((item, index) => {
    const [x, y, size, maxUnits] = positions[index];
    drawText(
      context,
      `· ${truncateHudTitle(item.title, maxUnits)}`,
      x,
      y,
      size,
      index < 4 ? COLOR.primary : COLOR.secondary,
      "bold",
    );
  });
  drawText(context, "NEWS // MORE", 308, 222, 10, COLOR.secondary, "bold");
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
  if (page === "navigation") drawNavigation(context, data.live.route);
  if (page === "news") drawNews(context, data.live);
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
  drawFastMap(context, data.live, data.mapRadiusMeters ?? 650);
  drawDynamicHeader(context, now, page, data.live);
  drawDynamicPage(context, page, data);
}
