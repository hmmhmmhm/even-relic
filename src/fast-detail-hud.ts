import {
  drawFastCanvasOpenFrame as drawFrame,
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";
import { wrapHudText } from "./fast-detail-text";
import type {
  DataState,
  LiveDashboardState,
  NewsItem,
  RouteValue,
  TodoItem,
} from "./live-state";

const WIDTH = 576;
const HEIGHT = 288;

export type FastDetailHudOptions = {
  readonly mode: "news" | "todo" | "navigation";
  readonly live: LiveDashboardState;
  readonly newsIndex: number;
  readonly todoIndex: number;
  readonly navigationIndex: number;
};

function formatPosition(index: number, count: number): string {
  const current = count > 0 ? Math.min(index, count - 1) + 1 : 0;
  return `${String(current).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
}

function formatDistance(distance: number): string {
  const rounded = Math.max(0, Math.round(distance));
  return rounded >= 1_000
    ? `${(rounded / 1_000).toFixed(1)}km`
    : `${rounded}m`;
}

function formatPublished(publishedAt: number | undefined): string {
  if (publishedAt === undefined) return "발행 시각 미상";
  const date = new Date(publishedAt);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `PUBLISHED // ${month}.${day} ${hour}:${minute}`;
}

function drawHeader(
  context: CanvasRenderingContext2D,
  title: string,
  counter?: string,
) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, 38);
  drawText(context, title, 14, 10, 16, COLOR.primary, "bold");
  if (counter) {
    drawText(context, counter, 474, 11, 13, COLOR.secondary, "bold");
  }
  context.fillStyle = COLOR.dim;
  context.fillRect(14, 36, 548, 1);
}

function drawFooter(
  context: CanvasRenderingContext2D,
  first: string,
  second?: string,
) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 254, WIDTH, 34);
  context.fillStyle = COLOR.dim;
  context.fillRect(14, 254, 548, 1);
  drawText(context, first, 14, 268, 10, COLOR.secondary, "bold");
  if (second) {
    drawText(context, second, 196, 268, 10, COLOR.secondary, "bold");
  }
  drawText(context, "DOUBLE TAP // BACK", 410, 268, 10, COLOR.primary, "bold");
}

function drawEmptyState(
  context: CanvasRenderingContext2D,
  headline: string,
  detail: string,
) {
  drawText(context, headline, 36, 84, 30, COLOR.primary, "bold");
  for (const [index, line] of wrapHudText(detail, 50, 3).entries()) {
    drawText(context, line, 38, 136 + index * 25, 17, COLOR.secondary, "bold");
  }
}

function newsLabel(state: DataState<readonly NewsItem[]>): string {
  if (state.status === "fresh") return "NEWS // LIVE";
  if (state.status === "stale") return "NEWS // STALE";
  if (state.status === "loading") return "NEWS // LOADING";
  return "NEWS // UNAVAILABLE";
}

function drawNews(
  context: CanvasRenderingContext2D,
  state: DataState<readonly NewsItem[]>,
  selectedIndex: number,
) {
  const items = state.value ?? [];
  const index = Math.min(Math.max(0, selectedIndex), Math.max(0, items.length - 1));
  drawHeader(context, newsLabel(state), formatPosition(index, items.length));
  drawFrame(context, 14, 44, 548, 204);
  const item = (state.status === "fresh" || state.status === "stale")
    ? items[index]
    : undefined;
  if (!item) {
    const loading = state.status === "loading";
    drawEmptyState(
      context,
      loading ? "뉴스 불러오는 중" : "뉴스를 표시할 수 없음",
      loading ? "RSS 업데이트를 기다리고 있습니다." : "연결 후 자동으로 다시 시도합니다.",
    );
    drawFooter(context, "SCROLL // ARTICLES");
    return;
  }

  const titleLines = wrapHudText(item.title, 36, 2);
  titleLines.forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      32,
      54 + lineIndex * 31,
      25,
      COLOR.primary,
      "bold",
    );
  });
  const summaryLines = wrapHudText(item.summary ?? "요약 없음", 41, 5);
  summaryLines.forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      34,
      118 + lineIndex * 21,
      16,
      lineIndex === 0 ? COLOR.secondary : COLOR.primary,
      "bold",
    );
  });
  drawText(
    context,
    formatPublished(item.publishedAt),
    34,
    230,
    10,
    COLOR.dim,
    "bold",
  );
  drawFooter(context, "SCROLL // ARTICLES");
}

function todoLabel(state: DataState<readonly TodoItem[]>): string {
  if (state.status === "fresh") return "TODO // ACTIVE";
  if (state.status === "stale") return "TODO // STALE";
  if (state.status === "loading") return "TODO // LOADING";
  return "TODO // UNAVAILABLE";
}

function drawTodo(
  context: CanvasRenderingContext2D,
  state: DataState<readonly TodoItem[]>,
  selectedIndex: number,
) {
  const items = state.value ?? [];
  const completed = items.filter((item) => item.completed).length;
  drawHeader(context, todoLabel(state), `완료 ${completed} / ${items.length}`);
  drawFrame(context, 14, 44, 548, 204);
  if (
    (state.status !== "fresh" && state.status !== "stale")
    || items.length === 0
  ) {
    drawEmptyState(
      context,
      state.status === "loading" ? "할 일 불러오는 중" : "할 일을 표시할 수 없음",
      "저장된 체크리스트를 확인하고 있습니다.",
    );
    drawFooter(context, "SCROLL // SELECT", "TAP // TOGGLE");
    return;
  }

  const index = Math.min(Math.max(0, selectedIndex), items.length - 1);
  items.slice(0, 6).forEach((item, itemIndex) => {
    const prefix = itemIndex === index ? "> " : "";
    const checkbox = item.completed ? "[X]" : "[ ]";
    const title = wrapHudText(item.title, 42, 1)[0] ?? "";
    drawText(
      context,
      `${prefix}${checkbox} ${title}`,
      itemIndex === index ? 28 : 42,
      55 + itemIndex * 31,
      itemIndex === index ? 19 : 17,
      item.completed ? COLOR.secondary : COLOR.primary,
      "bold",
    );
  });
  drawFooter(context, "SCROLL // SELECT", "TAP // TOGGLE");
}

function routeLabel(state: DataState<RouteValue>): string {
  if (state.status === "fresh") return "NAV // ACTIVE";
  if (state.status === "stale") return "NAV // STALE";
  if (state.status === "loading") return "NAV // LOADING";
  if (state.status === "disabled") return "NAV // DISABLED";
  return "NAV // UNAVAILABLE";
}

function drawNavigation(
  context: CanvasRenderingContext2D,
  state: DataState<RouteValue>,
  selectedIndex: number,
) {
  const route = state.value;
  const maneuvers = route?.maneuvers ?? [];
  const index = Math.min(
    Math.max(0, selectedIndex),
    Math.max(0, maneuvers.length - 1),
  );
  drawHeader(
    context,
    routeLabel(state),
    maneuvers.length > 0
      ? `STEP ${formatPosition(index, maneuvers.length)}`
      : undefined,
  );
  drawFrame(context, 14, 44, 548, 204);
  if (!route || maneuvers.length === 0) {
    const copy = state.status === "disabled"
      ? ["길찾기 키 필요", "폰에서 ORS 키를 설정하면 경로를 사용할 수 있습니다."]
      : state.status === "loading"
        ? ["경로 계산 중", "목적지까지의 경로를 준비하고 있습니다."]
        : ["목적지를 선택하세요", "폰 화면에서 목적지와 이동 방식을 선택하세요."];
    drawEmptyState(context, copy[0], copy[1]);
    drawFooter(context, "SCROLL // STEPS", "TAP // CURRENT");
    return;
  }

  const maneuver = maneuvers[index];
  drawText(
    context,
    `DEST // ${wrapHudText(route.destinationName, 38, 1)[0] ?? route.destinationName}`,
    32,
    54,
    13,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    `REMAIN // ${formatDistance(route.remainingDistance)}`,
    32,
    76,
    21,
    COLOR.primary,
    "bold",
  );
  wrapHudText(maneuver.instruction, 34, 3).forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      32,
      112 + lineIndex * 31,
      26,
      COLOR.primary,
      "bold",
    );
  });
  drawText(
    context,
    `STEP // ${formatDistance(maneuver.distance)}`,
    32,
    218,
    15,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    index === route.activeManeuverIndex ? "CURRENT" : "BROWSE",
    472,
    220,
    11,
    index === route.activeManeuverIndex ? COLOR.primary : COLOR.dim,
    "bold",
  );
  drawFooter(context, "SCROLL // STEPS", "TAP // CURRENT");
}

export function drawFastDetailHud(
  canvas: HTMLCanvasElement,
  options: FastDetailHudOptions,
): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  if (options.mode === "news") {
    drawNews(context, options.live.news, options.newsIndex);
  } else if (options.mode === "todo") {
    drawTodo(context, options.live.todos, options.todoIndex);
  } else {
    drawNavigation(
      context,
      options.live.route,
      options.navigationIndex,
    );
  }
}
