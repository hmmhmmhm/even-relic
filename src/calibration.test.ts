// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawCalibrationPattern } from "./calibration";

type Rectangle = {
  style: string;
  args: [number, number, number, number];
};

describe("G2 maximum-boundary calibration", () => {
  it("draws exact outer, inset, and center boundaries on a 576 by 288 canvas", () => {
    const rectangles: Rectangle[] = [];
    const labels: string[] = [];
    let fillStyle = "";

    const context = {
      get fillStyle() {
        return fillStyle;
      },
      set fillStyle(value: string | CanvasGradient | CanvasPattern) {
        fillStyle = String(value);
      },
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
      fillRect: (x: number, y: number, width: number, height: number) => {
        rectangles.push({ style: fillStyle, args: [x, y, width, height] });
      },
      fillText: (value: string) => labels.push(value),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;

    drawCalibrationPattern(canvas);

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(rectangles).toEqual(expect.arrayContaining([
      { style: "#000000", args: [0, 0, 576, 288] },
      { style: "#ffffff", args: [0, 0, 576, 4] },
      { style: "#ffffff", args: [0, 284, 576, 4] },
      { style: "#ffffff", args: [0, 0, 4, 288] },
      { style: "#ffffff", args: [572, 0, 4, 288] },
      { style: "#ffffff", args: [8, 8, 560, 2] },
      { style: "#ffffff", args: [8, 278, 560, 2] },
      { style: "#ffffff", args: [8, 8, 2, 272] },
      { style: "#ffffff", args: [566, 8, 2, 272] },
      { style: "#ffffff", args: [287, 0, 2, 288] },
      { style: "#ffffff", args: [0, 143, 576, 2] },
      { style: "#ffffff", args: [32, 4, 2, 12] },
      { style: "#ffffff", args: [4, 32, 12, 2] },
    ]));
    expect(labels).toEqual(["TL", "TR", "BL", "BR", "576×288 MAX"]);
  });
});
