// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

async function loadHybridHud() {
  const module = await import("./hybrid-hud").catch(() => null);
  expect(module).not.toBeNull();
  return module as null | {
    drawHybridHudBackground?: (canvas: HTMLCanvasElement) => void;
    drawLayeredHybridHudBackground?: (canvas: HTMLCanvasElement) => void;
    formatHybridHudText?: (
      page: "overview" | "navigation" | "news" | "todo",
      now?: Date,
    ) => string;
    HYBRID_TEXT_CONSOLE?: {
      x: number;
      y: number;
      width: number;
      height: number;
      padding: number;
    };
  };
}

function createCanvasRecorder() {
  const rectangles: Array<{
    style: string;
    args: [number, number, number, number];
  }> = [];
  const texts: string[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  let currentPath: Array<[number, number]> = [];
  const context = {
    imageSmoothingEnabled: true,
    lineWidth: 1,
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
    fillRect: (x: number, y: number, width: number, height: number) => {
      rectangles.push({ style: fillStyle, args: [x, y, width, height] });
    },
    fillText: (value: string) => {
      texts.push(value);
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
    stroke: () => undefined,
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return { canvas, rectangles, texts };
}

describe("hybrid native Text HUD", () => {
  it("draws a 576 by 288 tactical background without any Canvas text", async () => {
    const module = await loadHybridHud();
    if (!module) return;
    expect(module.drawHybridHudBackground).toBeTypeOf("function");
    if (!module.drawHybridHudBackground) return;

    const { canvas, rectangles, texts } = createCanvasRecorder();

    module.drawHybridHudBackground(canvas);

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(texts).toEqual([]);
    expect(rectangles).toEqual(expect.arrayContaining([
      { style: "#000000", args: [0, 0, 576, 288] },
      { style: "#555555", args: [0, 63, 576, 1] },
      { style: "#555555", args: [195, 64, 1, 224] },
    ]));
    expect(new Set(rectangles.map(({ style }) => style))).toEqual(new Set([
      "#000000",
      "#ffffff",
      "#aaaaaa",
      "#555555",
    ]));
  });

  it("draws a map and one line-height-independent Text console", async () => {
    const module = await loadHybridHud();
    if (!module) return;
    expect(module.drawLayeredHybridHudBackground).toBeTypeOf("function");
    if (!module.drawLayeredHybridHudBackground) return;
    expect(module.HYBRID_TEXT_CONSOLE).toEqual({
      x: 196,
      y: 8,
      width: 372,
      height: 272,
      padding: 8,
    });
    const { canvas, rectangles, texts } = createCanvasRecorder();

    module.drawLayeredHybridHudBackground(canvas);

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(rectangles).toEqual(expect.arrayContaining([
      { style: "#555555", args: [8, 8, 14, 1] },
      { style: "#555555", args: [196, 8, 14, 1] },
    ]));
    expect(rectangles).not.toContainEqual({
      style: "#555555",
      args: [0, 63, 576, 1],
    });
    expect(texts).toEqual([]);
  });

  it("formats four native page strings with shared live context", async () => {
    const module = await loadHybridHud();
    if (!module) return;
    expect(module.formatHybridHudText).toBeTypeOf("function");
    if (!module.formatHybridHudText) return;
    const fixedDate = new Date(2026, 6, 26, 14, 37, 42);

    const overview = module.formatHybridHudText("overview", fixedDate);
    const navigation = module.formatHybridHudText("navigation", fixedDate);
    const news = module.formatHybridHudText("news", fixedDate);
    const todo = module.formatHybridHudText("todo", fixedDate);

    for (const [index, content] of [
      overview,
      navigation,
      news,
      todo,
    ].entries()) {
      const lines = content.split("\n");
      expect(lines).toHaveLength(8);
      expect(lines[0]).toContain("14:37:42");
      expect(lines[0]).toContain("23°C 맑음");
      expect(lines[0]).toContain(`0${index + 1} / 04`);
      expect(lines[1]).toBe("RELIC // LIVE   HONGDAE");
      expect(lines[2]).toBe("");
      expect(Math.max(...lines.map((line) => Array.from(line).length)))
        .toBeLessThanOrEqual(27);
    }
    expect(overview.split("\n").slice(3)).toEqual([
      "NEWS // OVERVIEW",
      "2호선 정상 운행",
      "홍대입구역 혼잡도 보통",
      "[ ] 지하철역으로 이동",
      "MIC -24 dBFS",
    ]);
    expect(navigation).toContain("02 / 04");
    expect(navigation).toContain("우회전 →");
    expect(news).toContain("03 / 04");
    expect(news).toContain("NEWS // FOCUS");
    expect(todo).toContain("04 / 04");
    expect(todo).toContain("[ ] 우산 챙기기");
    expect(todo).toContain("[x] 경로 확인");
  });
});
