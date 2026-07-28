import { describe, expect, it } from "vitest";
import {
  drawFastWeatherIcon,
  weatherIconKind,
} from "./fast-weather-icon";

describe("fast weather icon", () => {
  it.each([
    [0, "sun"],
    [1, "partly-cloudy"],
    [2, "partly-cloudy"],
    [3, "cloud"],
    [45, "fog"],
    [48, "fog"],
    [51, "rain"],
    [67, "rain"],
    [71, "snow"],
    [77, "snow"],
    [80, "rain"],
    [82, "rain"],
    [85, "snow"],
    [86, "snow"],
    [95, "thunder"],
    [99, "thunder"],
  ] as const)("maps weather code %i to %s", (code, expected) => {
    expect(weatherIconKind(code)).toBe(expected);
  });

  it("draws every icon as bounded geometric paths", () => {
    const points: Array<[number, number]> = [];
    let strokes = 0;
    let fills = 0;
    const context = {
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
      lineCap: "butt",
      lineJoin: "miter",
      beginPath: () => undefined,
      moveTo: (x: number, y: number) => points.push([x, y]),
      lineTo: (x: number, y: number) => points.push([x, y]),
      closePath: () => undefined,
      stroke: () => {
        strokes += 1;
      },
      fill: () => {
        fills += 1;
      },
    } as unknown as CanvasRenderingContext2D;

    for (const code of [0, 1, 3, 45, 51, 71, 95]) {
      drawFastWeatherIcon(context, code, 100, 50, 80);
    }

    expect(strokes).toBeGreaterThanOrEqual(7);
    expect(fills).toBeGreaterThanOrEqual(1);
    expect(points.length).toBeGreaterThan(50);
    expect(points.every(([x, y]) =>
      x >= 100 && x <= 180 && y >= 50 && y <= 130
    )).toBe(true);
  });
});
