// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawFastDetailHud } from "./fast-detail-hud";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";

type DrawnText = {
  readonly value: string;
  readonly x: number;
  readonly y: number;
  readonly style: string;
  readonly font: string;
};

function createCanvas() {
  const texts: DrawnText[] = [];
  const rectangles: number[][] = [];
  const rawContext = {
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "top",
    imageSmoothingEnabled: true,
    fillRect: (...args: number[]) => rectangles.push(args),
    fillText(value: string, x: number, y: number) {
      texts.push({
        value,
        x,
        y,
        style: rawContext.fillStyle,
        font: rawContext.font,
      });
    },
  };
  const context = rawContext as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return { canvas, texts, rectangles };
}

function liveState(): LiveDashboardState {
  const initial = createInitialLiveDashboardState();
  return {
    ...initial,
    news: {
      status: "fresh",
      fetchedAt: Date.parse("2026-07-27T05:00:00Z"),
      value: Array.from({ length: 6 }, (_, index) => ({
        id: `news-${index}`,
        title: index === 0 ? "첫 번째 실제 기사 제목" : `뉴스 ${index + 1}`,
        summary: index === 0
          ? "RSS 요약 내용이 안경 전체 화면에 선명하게 표시됩니다."
          : undefined,
        publishedAt: Date.parse("2026-07-27T05:00:00Z") - index * 60_000,
      })),
    },
    route: {
      status: "fresh",
      fetchedAt: Date.parse("2026-07-27T05:00:00Z"),
      value: {
        destinationName: "홍대입구역",
        geometry: [],
        maneuvers: [
          { instruction: "오른쪽 골목으로 우회전", distance: 120, wayPoints: [0, 1] },
          { instruction: "횡단보도를 건너 직진", distance: 80, wayPoints: [1, 2] },
        ],
        activeManeuverIndex: 1,
        remainingDistance: 820,
        profile: "foot-walking",
      },
    },
  };
}

function values(texts: readonly DrawnText[]) {
  return texts.map(({ value }) => value);
}

describe("drawFastDetailHud", () => {
  it("draws a full-screen RSS article with summary and position", () => {
    const { canvas, texts, rectangles } = createCanvas();

    drawFastDetailHud(canvas, {
      mode: "news",
      live: liveState(),
      newsIndex: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(rectangles[0]).toEqual([0, 0, 576, 288]);
    expect(values(texts)).toEqual(expect.arrayContaining([
      "NEWS // LIVE",
      "01 / 06",
      "첫 번째 실제 기사 제목",
      "RSS 요약 내용이 안경 전체 화면에 선명하게",
      "DOUBLE TAP // BACK",
    ]));
  });

  it("draws all TODOs, progress, selection, and controls", () => {
    const { canvas, texts } = createCanvas();

    drawFastDetailHud(canvas, {
      mode: "todo",
      live: liveState(),
      newsIndex: 0,
      todoIndex: 1,
      navigationIndex: 0,
    });

    expect(values(texts)).toEqual(expect.arrayContaining([
      "TODO // ACTIVE",
      "완료 1 / 3",
      "[ ] 지하철역으로 이동",
      "> [ ] 우산 챙기기",
      "[X] 경로 확인",
      "TAP // TOGGLE",
      "DOUBLE TAP // BACK",
    ]));
  });

  it("draws one route step with current-step context", () => {
    const { canvas, texts } = createCanvas();

    drawFastDetailHud(canvas, {
      mode: "navigation",
      live: liveState(),
      newsIndex: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(values(texts)).toEqual(expect.arrayContaining([
      "NAV // ACTIVE",
      "STEP 01 / 02",
      "DEST // 홍대입구역",
      "오른쪽 골목으로 우회전",
      "STEP // 120m",
      "TAP // CURRENT",
      "DOUBLE TAP // BACK",
    ]));
  });

  it.each([
    ["news", "loading", "NEWS // LOADING"],
    ["news", "unavailable", "NEWS // UNAVAILABLE"],
    ["todo", "loading", "TODO // LOADING"],
    ["todo", "unavailable", "TODO // UNAVAILABLE"],
    ["navigation", "loading", "NAV // LOADING"],
    ["navigation", "disabled", "NAV // DISABLED"],
    ["navigation", "unavailable", "NAV // UNAVAILABLE"],
  ] as const)("shows %s %s state", (mode, status, expected) => {
    const live = {
      ...liveState(),
      [mode === "navigation" ? "route" : mode === "todo" ? "todos" : "news"]: {
        status,
      },
    } as LiveDashboardState;
    const { canvas, texts } = createCanvas();

    drawFastDetailHud(canvas, {
      mode,
      live,
      newsIndex: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(values(texts)).toContain(expected);
    expect(values(texts)).toContain("DOUBLE TAP // BACK");
  });
});
