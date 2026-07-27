// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawFastMap } from "./fast-map";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";

type Stroke = {
  readonly style: string;
  readonly width: number;
  readonly points: readonly [number, number][];
  readonly order: number;
};
type Text = {
  readonly value: string;
  readonly style: string;
  readonly font: string;
  readonly order: number;
};
type Rectangle = {
  readonly style: string;
  readonly args: readonly [number, number, number, number];
  readonly order: number;
};

function liveState(): LiveDashboardState {
  const initial = createInitialLiveDashboardState();
  return {
    ...initial,
    location: {
      status: "fresh",
      value: {
        coordinate: { latitude: 37.5563, longitude: 126.922 },
        source: "live",
        heading: 47,
      },
    },
    map: {
      status: "fresh",
      fetchedAt: 1,
      value: {
        cell: "37.555,126.920",
        attribution: "© OSM CONTRIBUTORS",
        roads: [
          {
            kind: "major",
            points: [
              { latitude: 37.54, longitude: 126.9 },
              { latitude: 37.58, longitude: 126.95 },
            ],
          },
          {
            kind: "minor",
            points: [
              { latitude: 37.555, longitude: 126.921 },
              { latitude: 37.557, longitude: 126.923 },
            ],
          },
        ],
        labels: [
          {
            kind: "transit",
            name: "홍대입구역",
            point: { latitude: 37.5603, longitude: 126.918 },
          },
          {
            kind: "road",
            name: "양화로",
            point: { latitude: 37.5593, longitude: 126.926 },
          },
          {
            kind: "landmark",
            name: "경의선숲길",
            point: { latitude: 37.5533, longitude: 126.918 },
          },
          {
            kind: "place",
            name: "화살표와 겹침",
            point: { latitude: 37.5563, longitude: 126.922 },
          },
        ],
      },
    },
    route: {
      status: "fresh",
      fetchedAt: 1,
      value: {
        destinationName: "홍대입구역",
        geometry: [
          { latitude: 37.5563, longitude: 126.922 },
          { latitude: 37.557, longitude: 126.923 },
        ],
        maneuvers: [],
        activeManeuverIndex: 0,
        remainingDistance: 800,
        profile: "foot-walking",
      },
    },
  };
}

function draw(live: LiveDashboardState) {
  const strokes: Stroke[] = [];
  const fills: Array<{ style: string; order: number }> = [];
  const texts: Text[] = [];
  const rectangles: Rectangle[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  let lineWidth = 1;
  let order = 0;
  let points: [number, number][] = [];
  const context = {
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
      rectangles.push({
        style: fillStyle,
        args: [x, y, width, height],
        order: order++,
      });
    },
    fillText: (value: string) => {
      texts.push({
        value,
        style: fillStyle,
        font: context.font,
        order: order++,
      });
    },
    beginPath: () => {
      points = [];
    },
    moveTo: (x: number, y: number) => {
      points.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      points.push([x, y]);
    },
    closePath: () => undefined,
    stroke: () => {
      strokes.push({
        style: strokeStyle,
        width: lineWidth,
        points: [...points],
        order: order++,
      });
    },
    fill: () => {
      fills.push({ style: fillStyle, order: order++ });
    },
  } as unknown as CanvasRenderingContext2D;

  drawFastMap(context, live);
  return { strokes, fills, texts, rectangles };
}

describe("fast OSM map Canvas layer", () => {
  it("draws minor, major, route, and position layers in tactical order", () => {
    const result = draw(liveState());
    const minor = result.strokes.find(
      ({ style, width }) => style === "#808080" && width === 1,
    );
    const major = result.strokes.find(
      ({ style, width }) => style === "#d0d0d0" && width === 2,
    );
    const route = result.strokes.filter(
      ({ width }) => width === 6 || width === 3,
    );
    const labels = result.texts.filter(({ value }) => [
      "홍대입구역",
      "양화로",
      "경의선숲길",
    ].includes(value));

    expect(minor).toBeTruthy();
    expect(major).toBeTruthy();
    expect(route).toHaveLength(2);
    expect(labels.map(({ value }) => value)).toEqual([
      "홍대입구역",
      "양화로",
      "경의선숲길",
    ]);
    expect(minor!.order).toBeLessThan(major!.order);
    expect(major!.order).toBeLessThan(labels[0].order);
    expect(labels.at(-1)!.order).toBeLessThan(route[0].order);
    expect(route[1].order).toBeLessThan(result.fills.at(-1)!.order);
    expect(labels.map(({ style, font }) => ({ style, font }))).toEqual([
      { style: "#ffffff", font: expect.stringContaining("bold 14px") },
      { style: "#d0d0d0", font: expect.stringContaining("bold 12px") },
      { style: "#d0d0d0", font: expect.stringContaining("bold 12px") },
    ]);
    for (const label of labels) {
      expect(result.rectangles).toContainEqual(expect.objectContaining({
        style: "#000000",
        order: label.order - 1,
      }));
    }
    expect(result.texts.some(
      ({ value }) => value === "화살표와 겹침",
    )).toBe(false);
  });

  it("clamps all projected road and route points to the map viewport", () => {
    const result = draw(liveState());
    const geometry = result.strokes.filter(
      ({ width }) => [1, 2, 3, 6].includes(width),
    );

    for (const { points } of geometry) {
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(18);
        expect(x).toBeLessThanOrEqual(270);
        expect(y).toBeGreaterThanOrEqual(34);
        expect(y).toBeLessThanOrEqual(244);
      }
    }
  });

  it("always shows attribution and labels a fallback as schematic", () => {
    expect(draw(liveState()).texts.map(({ value }) => value)).toEqual(
      expect.arrayContaining([
      "LOC // LIVE · OSM",
      "© OSM CONTRIBUTORS",
      ]),
    );

    const initial = createInitialLiveDashboardState();
    const fallback = draw({
      ...initial,
      map: { status: "unavailable" },
    });
    expect(fallback.texts.map(({ value }) => value)).toEqual(
      expect.arrayContaining([
      "LOC // DEMO · SCHEMATIC",
      "© OSM CONTRIBUTORS",
      ]),
    );
  });
});
