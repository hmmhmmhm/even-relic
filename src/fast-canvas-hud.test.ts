// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

type HudPage = "overview" | "navigation" | "news" | "todo";
type Rectangle = {
  style: string;
  args: [number, number, number, number];
};
type TextRecord = {
  style: string;
  font: string;
  value: string;
  x: number;
  y: number;
};
type PathRecord = {
  style: string;
  width: number;
  points: Array<[number, number]>;
};
type FastHudModule = {
  FAST_HUD_PAGES?: readonly HudPage[];
  getAdjacentFastHudPage?: (
    page: HudPage,
    direction: "next" | "previous",
  ) => HudPage;
  drawFastCanvasHud?: (
    canvas: HTMLCanvasElement,
    now?: Date,
    page?: HudPage,
  ) => void;
};

async function loadFastHud() {
  const modulePath = "./fast-canvas-hud";
  const module = await import(
    /* @vite-ignore */ modulePath
  ).catch(() => null);
  expect(module).not.toBeNull();
  return module as FastHudModule | null;
}

function renderFastHud(module: FastHudModule, page: HudPage) {
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
    fillText: (value: string, x: number, y: number) => {
      texts.push({ style: fillStyle, font: context.font, value, x, y });
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

  module.drawFastCanvasHud!(
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
    paintedStyles: [
      ...rectangles.map(({ style }) => style),
      ...texts.map(({ style }) => style),
      ...strokedPaths.map(({ style }) => style),
      ...filledPaths.map(({ style }) => style),
    ],
  };
}

function leftSnapshot(hud: ReturnType<typeof renderFastHud>) {
  return {
    rectangles: hud.rectangles.filter(
      ({ args: [x, , width] }) => x + width <= 288,
    ),
    texts: hud.texts.filter(({ x }) => x < 288),
    strokedPaths: hud.strokedPaths.filter(({ points }) =>
      points.every(([x]) => x < 288)
    ),
    filledPaths: hud.filledPaths.filter(({ points }) =>
      points.every(([x]) => x < 288)
    ),
  };
}

describe("fast split Canvas HUD", () => {
  it("uses the approved fast-only circular page order", async () => {
    const module = await loadFastHud();
    if (!module) return;

    expect(module.FAST_HUD_PAGES).toEqual([
      "overview",
      "news",
      "todo",
      "navigation",
    ]);
    expect(module.getAdjacentFastHudPage).toBeTypeOf("function");
    expect(module.getAdjacentFastHudPage?.("overview", "next")).toBe("news");
    expect(module.getAdjacentFastHudPage?.("navigation", "next")).toBe(
      "overview",
    );
    expect(module.getAdjacentFastHudPage?.("overview", "previous")).toBe(
      "navigation",
    );
  });

  it("keeps a static left map and draws high-contrast right pages", async () => {
    const module = await loadFastHud();
    if (!module) return;
    expect(module.drawFastCanvasHud).toBeTypeOf("function");
    if (!module.drawFastCanvasHud) return;

    const pageNames: HudPage[] = [
      "overview",
      "news",
      "todo",
      "navigation",
    ];
    const pages = pageNames.map((page) => renderFastHud(module, page));

    for (const [index, hud] of pages.entries()) {
      expect(hud.canvas.width).toBe(576);
      expect(hud.canvas.height).toBe(288);
      expect(hud.values).toEqual(expect.arrayContaining([
        "14:37",
        "HONGDAE  23°C 맑음",
        `0${index + 1} / 04`,
        "MAP // HONGDAE",
      ]));
      expect(hud.values).not.toContain("14:37:42");
      expect(hud.texts.some(({ font }) => /(?:2[0-8])px/.test(font))).toBe(true);
    }
    expect(new Set(pages[0].paintedStyles)).toEqual(new Set([
      "#000000",
      "#ffffff",
      "#d0d0d0",
      "#808080",
    ]));
    expect(pages.map(leftSnapshot)).toEqual([
      leftSnapshot(pages[0]),
      leftSnapshot(pages[0]),
      leftSnapshot(pages[0]),
      leftSnapshot(pages[0]),
    ]);
    expect(pages[3].values).toEqual(expect.arrayContaining([
      "NAV // ACTIVE",
      "120m",
      "우회전",
      "다음 교차로",
    ]));
    expect(pages[1].values.filter((value) => value.startsWith("· "))).toHaveLength(
      6,
    );
    expect(pages[1].values).not.toContain("2호선 정상 운행");
    expect(pages[2].values).toEqual(expect.arrayContaining([
      "TODO // ACTIVE",
      "지하철역으로 이동",
      "우산 챙기기",
      "경로 확인",
      "완료 1 / 3",
    ]));
    expect(pages[2].values).not.toContain("CONNECTED");
    expect(pages[2].values).not.toContain("LINK // G2 + R1");
  });
});
