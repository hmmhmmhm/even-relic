// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawDenseCanvasHud } from "./canvas-hud";

type Rectangle = {
  style: string;
  args: [number, number, number, number];
};
type TextRecord = {
  style: string;
  value: string;
};
type PathRecord = {
  style: string;
  width: number;
  points: Array<[number, number]>;
};

describe("dense Canvas HUD", () => {
  it("fills the 576 by 288 display with fixed panels and readable mock data", () => {
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
        texts.push({ style: fillStyle, value });
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
      { style: "#555555", args: [8, 72, 184, 1] },
      { style: "#555555", args: [204, 72, 188, 1] },
      { style: "#555555", args: [404, 72, 164, 1] },
    ]));
    expect(new Set(paintedStyles)).toEqual(new Set([
      "#000000",
      "#ffffff",
      "#aaaaaa",
      "#555555",
    ]));
    expect(texts.map(({ value }) => value)).toEqual(expect.arrayContaining([
      "14:37",
      "HONGDAE",
      "NE 047°",
      "NEXT 120m",
      "우회전",
      "-24 dBFS",
      "X +0.12",
      "Y -0.03",
      "Z +0.98",
      "다음 교차로에서",
      "Q. 지하철역으로 이동",
      "NEWS 02",
    ]));
    expect(strokedPaths.length).toBeGreaterThanOrEqual(8);
    expect(filledPaths.length).toBeGreaterThanOrEqual(2);
  });
});
