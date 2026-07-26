// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawDenseCanvasHud } from "./canvas-hud";

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

describe("dense Canvas HUD", () => {
  it("fills the 576 by 288 display with a readable tactical mission layout", () => {
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

    drawDenseCanvasHud(canvas);

    const paintedStyles = [
      ...rectangles.map(({ style }) => style),
      ...texts.map(({ style }) => style),
      ...strokedPaths.map(({ style }) => style),
      ...filledPaths.map(({ style }) => style),
    ];

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(rectangles).toEqual(expect.arrayContaining([
      { style: "#000000", args: [0, 0, 576, 288] },
      { style: "#555555", args: [8, 72, 16, 1] },
      { style: "#555555", args: [204, 72, 16, 1] },
      { style: "#555555", args: [404, 72, 16, 1] },
      { style: "#555555", args: [404, 142, 16, 1] },
      { style: "#555555", args: [552, 279, 16, 1] },
    ]));
    expect(new Set(paintedStyles)).toEqual(new Set([
      "#000000",
      "#ffffff",
      "#aaaaaa",
      "#555555",
    ]));
    const values = texts.map(({ value }) => value);
    expect(values).toEqual(expect.arrayContaining([
      "14:37",
      "HONGDAE",
      "NE 047°",
      "NAV // ROUTE 01",
      "120m",
      "우회전",
      "-24 dBFS",
      "다음 교차로",
      "NEWS // 02",
      "MISSION ACTIVE",
      "지하철역으로",
      "이동",
      "ROUTE UPDATED",
    ]));
    for (const forbiddenValue of [
      "ACC",
      "X +0.12",
      "Y -0.03",
      "Z +0.98",
    ]) {
      expect(values).not.toContain(forbiddenValue);
    }

    const newsBody = texts.find(({ value }) => value === "지하철역으로");
    const missionAction = texts.find(({ value }) => value === "이동");
    expect(newsBody?.font).toContain("17px");
    expect(missionAction?.font).toContain("24px");
    expect(strokedPaths).toEqual(expect.arrayContaining([
      expect.objectContaining({ style: "#aaaaaa", width: 6 }),
      expect.objectContaining({ style: "#ffffff", width: 2 }),
      expect.objectContaining({ style: "#aaaaaa", width: 8 }),
      expect.objectContaining({ style: "#ffffff", width: 3 }),
    ]));
    expect(strokedPaths.length).toBeGreaterThanOrEqual(8);
    expect(filledPaths.length).toBeGreaterThanOrEqual(1);
  });
});
