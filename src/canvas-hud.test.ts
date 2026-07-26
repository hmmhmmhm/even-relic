// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as canvasHud from "./canvas-hud";

type HudPage = "overview" | "navigation" | "news" | "todo";
type Rectangle = {
  style: string;
  args: [number, number, number, number];
};
type TextRecord = {
  style: string;
  font: string;
  value: string;
};
type PathRecord = {
  style: string;
  width: number;
  points: Array<[number, number]>;
};

function renderHud(page?: HudPage) {
  const rectangles: Rectangle[] = [];
  const texts: TextRecord[] = [];
  const strokedPaths: PathRecord[] = [];
  const filledPaths: PathRecord[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  let lineWidth = 1;
  let currentPath: Array<[number, number]> = [];

  const context = {
    imageSmoothingEnabled: true,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    lineCap: "butt",
    lineJoin: "miter",
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      fillStyle = String(value);
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
      strokeStyle = String(value);
    },
    get lineWidth() {
      return lineWidth;
    },
    set lineWidth(value: number) {
      lineWidth = value;
    },
    fillRect: (x: number, y: number, width: number, height: number) => {
      rectangles.push({ style: fillStyle, args: [x, y, width, height] });
    },
    fillText: (value: string) => {
      texts.push({ style: fillStyle, font: context.font, value });
    },
    beginPath: () => {
      currentPath = [];
    },
    moveTo: (x: number, y: number) => {
      currentPath.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      currentPath.push([x, y]);
    },
    closePath: () => undefined,
    stroke: () => {
      strokedPaths.push({
        style: strokeStyle,
        width: lineWidth,
        points: [...currentPath],
      });
    },
    fill: () => {
      filledPaths.push({
        style: fillStyle,
        width: 0,
        points: [...currentPath],
      });
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;

  canvasHud.drawDenseCanvasHud(
    canvas,
    new Date(2026, 6, 26, 14, 37, 42),
    page,
  );

  return {
    canvas,
    rectangles,
    texts,
    values: texts.map(({ value }) => value),
    strokedPaths,
    filledPaths,
  };
}

describe("dense Canvas HUD", () => {
  it("defaults to a non-navigation news overview", () => {
    const hud = renderHud();

    expect(canvasHud.HUD_PAGES).toEqual([
      "overview",
      "navigation",
      "news",
      "todo",
    ]);
    expect(hud.values).toEqual(expect.arrayContaining([
      "14:37:42",
      "HONGDAE  23°C 맑음",
      "NE 047°",
      "01 / 04",
      "NEWS // LOCAL 01",
      "2호선 정상 운행",
      "홍대입구역 혼잡도",
      "보통",
      "BRIEF // 02",
      "오늘 23°C · 맑음",
      "강수 10%",
      "-24 dBFS",
      "TODO // ACTIVE",
    ]));
    expect(hud.values).not.toContain("NAV // ROUTE 01");
    expect(hud.values).not.toContain("다음 교차로");
    expect(hud.values).not.toContain("우회전");
  });

  it("wraps page navigation in both directions", () => {
    const getAdjacentHudPage = (
      canvasHud as unknown as {
        getAdjacentHudPage?: (
          page: HudPage,
          direction: "next" | "previous",
        ) => HudPage;
      }
    ).getAdjacentHudPage;

    expect(getAdjacentHudPage).toBeTypeOf("function");
    if (!getAdjacentHudPage) return;
    expect(getAdjacentHudPage("overview", "next")).toBe("navigation");
    expect(getAdjacentHudPage("todo", "next")).toBe("overview");
    expect(getAdjacentHudPage("overview", "previous")).toBe("todo");
  });

  it("keeps the approved navigation dashboard on its own page", () => {
    const hud = renderHud("navigation");

    expect(hud.values).toEqual(expect.arrayContaining([
      "02 / 04",
      "MAP // LOCAL 120m",
      "NAV // ROUTE 01",
      "120m",
      "다음 교차로",
      "우회전",
      "TODO // ACTIVE",
    ]));
    expect(hud.strokedPaths).toEqual(expect.arrayContaining([
      expect.objectContaining({ style: "#aaaaaa", width: 6 }),
      expect.objectContaining({ style: "#ffffff", width: 2 }),
      expect.objectContaining({ style: "#aaaaaa", width: 8 }),
      expect.objectContaining({ style: "#ffffff", width: 3 }),
    ]));
  });

  it("gives news a large focused page", () => {
    expect(renderHud("news").values).toEqual(expect.arrayContaining([
      "03 / 04",
      "NEWS // FOCUS",
      "2호선 정상 운행",
      "홍대입구역 혼잡도 보통",
      "오늘 23°C · 맑음",
      "강수 확률 10%",
    ]));
  });

  it("gives tasks and device status a large focused page", () => {
    const hud = renderHud("todo");

    expect(hud.values).toEqual(expect.arrayContaining([
      "04 / 04",
      "TODO // FOCUS",
      "지하철역으로 이동",
      "우산 챙기기",
      "경로 확인",
      "AUDIO // STATUS",
      "LINK // G2 + R1",
    ]));
    expect(hud.strokedPaths).toEqual(expect.arrayContaining([
      expect.objectContaining({ style: "#ffffff", width: 2 }),
    ]));
  });

  it("preserves display size, palette, map layering, and Canvas checkboxes", () => {
    const hud = renderHud();
    const paintedStyles = [
      ...hud.rectangles.map(({ style }) => style),
      ...hud.texts.map(({ style }) => style),
      ...hud.strokedPaths.map(({ style }) => style),
      ...hud.filledPaths.map(({ style }) => style),
    ];

    expect(hud.canvas.width).toBe(576);
    expect(hud.canvas.height).toBe(288);
    expect(new Set(paintedStyles)).toEqual(new Set([
      "#000000",
      "#ffffff",
      "#aaaaaa",
      "#555555",
    ]));
    expect(hud.rectangles).toEqual(expect.arrayContaining([
      { style: "#000000", args: [0, 0, 576, 288] },
      { style: "#555555", args: [8, 72, 16, 1] },
      { style: "#555555", args: [204, 72, 16, 1] },
      { style: "#555555", args: [404, 72, 16, 1] },
      { style: "#555555", args: [404, 142, 16, 1] },
      { style: "#555555", args: [552, 279, 16, 1] },
      { style: "#ffffff", args: [416, 190, 12, 12] },
      { style: "#000000", args: [419, 193, 6, 6] },
      { style: "#aaaaaa", args: [416, 255, 10, 10] },
      { style: "#000000", args: [419, 258, 4, 4] },
    ]));
    expect(hud.strokedPaths).toEqual(expect.arrayContaining([
      expect.objectContaining({ style: "#aaaaaa", width: 6 }),
      expect.objectContaining({ style: "#ffffff", width: 2 }),
      expect.objectContaining({
        style: "#ffffff",
        width: 2,
        points: [[418, 260], [420, 263], [425, 257]],
      }),
    ]));
    expect(hud.filledPaths.length).toBeGreaterThanOrEqual(1);
    expect(hud.texts.find(({ value }) => value === "14:37:42")?.font)
      .toContain("22px");
    for (const forbiddenValue of [
      "14:37",
      "MISSION ACTIVE",
      "ROUTE UPDATED",
      "ACC",
      "X +0.12",
      "Y -0.03",
      "Z +0.98",
    ]) {
      expect(hud.values).not.toContain(forbiddenValue);
    }
  });
});
