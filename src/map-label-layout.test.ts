import { describe, expect, it } from "vitest";
import type { Coordinate, MapLabel } from "./live-state";
import {
  layoutMapLabels,
  MAX_VISIBLE_MAP_LABELS,
} from "./map-label-layout";

const CENTER: Coordinate = {
  latitude: 37.5563,
  longitude: 126.922,
};
const SCALE = 112 / 650;
const METERS_PER_LATITUDE = 111_320;
const METERS_PER_LONGITUDE = (
  111_320 * Math.cos(CENTER.latitude * Math.PI / 180)
);
const ARROW = {
  left: 128,
  top: 126,
  right: 160,
  bottom: 162,
};

function coordinateAt(x: number, y: number): Coordinate {
  return {
    latitude: CENTER.latitude
      + ((144 - y) / SCALE) / METERS_PER_LATITUDE,
    longitude: CENTER.longitude
      + ((x - 144) / SCALE) / METERS_PER_LONGITUDE,
  };
}

function intersects(
  left: { left: number; top: number; right: number; bottom: number },
  right: { left: number; top: number; right: number; bottom: number },
) {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

function collisionBox(label: ReturnType<typeof layoutMapLabels>[number]) {
  return {
    left: label.x - 4,
    top: label.y - 4,
    right: label.x + label.width + 4,
    bottom: label.y + label.height + 4,
  };
}

describe("balanced map label layout", () => {
  it("prioritizes and caps deterministic labels inside the viewport", () => {
    const positions = [
      [36, 46], [96, 46], [192, 46], [252, 46],
      [36, 96], [96, 96], [192, 96], [252, 96],
      [36, 192], [96, 192], [192, 192], [252, 192],
      [36, 232], [96, 232],
    ] as const;
    const candidates: MapLabel[] = positions.map(([x, y], index) => ({
      kind: index === 0 ? "transit" : "road",
      name: index === 0 ? "홍대입구역" : `R${index}`,
      point: coordinateAt(x, y),
    }));

    const first = layoutMapLabels(candidates, CENTER);
    const second = layoutMapLabels(candidates, CENTER);

    expect(first).toHaveLength(MAX_VISIBLE_MAP_LABELS);
    expect(first[0]).toMatchObject({
      kind: "transit",
      text: "홍대입구역",
      fontSize: 14,
    });
    expect(first.find(({ kind }) => kind === "road")).toMatchObject({
      fontSize: 12,
      width: 16,
    });
    expect(second).toEqual(first);
    for (const label of first) {
      expect(label.x).toBeGreaterThanOrEqual(18);
      expect(label.x + label.width).toBeLessThanOrEqual(270);
      expect(label.y).toBeGreaterThanOrEqual(34);
      expect(label.y + label.height).toBeLessThanOrEqual(244);
    }
  });

  it("keeps expanded label boxes apart and clear of the position arrow", () => {
    const candidates: MapLabel[] = [
      {
        kind: "road",
        name: "낮은 우선순위",
        point: coordinateAt(70, 80),
      },
      {
        kind: "transit",
        name: "높은 우선순위",
        point: coordinateAt(70, 80),
      },
      {
        kind: "place",
        name: "화살표와 겹침",
        point: coordinateAt(144, 144),
      },
      {
        kind: "landmark",
        name: "독립 장소",
        point: coordinateAt(230, 70),
      },
    ];

    const result = layoutMapLabels(candidates, CENTER);
    const boxes = result.map(collisionBox);

    expect(result.map(({ text }) => text)).toEqual([
      "높은 우선순위",
      "독립 장소",
    ]);
    for (const box of boxes) {
      expect(intersects(box, ARROW)).toBe(false);
    }
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        expect(intersects(boxes[left], boxes[right])).toBe(false);
      }
    }
  });

  it("shortens mixed-width names within the kind-specific display budget", () => {
    const [label] = layoutMapLabels([{
      kind: "place",
      name: "아주 긴 홍대 주변 Place Name",
      point: coordinateAt(220, 90),
    }], CENTER);

    expect(label.text.endsWith("…")).toBe(true);
    expect([...label.text].reduce(
      (units, character) =>
        units + (/^[\x00-\x7F]$/.test(character) ? 1 : 2),
      0,
    )).toBeLessThanOrEqual(16);
  });

  it("lays out more labels inside a zoomable fullscreen viewport", () => {
    const candidates: MapLabel[] = [
      [70, 48], [144, 48], [218, 48],
      [70, 94], [144, 94], [218, 94],
      [70, 194], [144, 194], [218, 194],
      [70, 232], [144, 232], [218, 232],
    ].map(([x, y], index) => ({
      kind: index === 0 ? "transit" : "road",
      name: `L${index}`,
      point: coordinateAt(x, y),
    }));
    const viewport = {
      minX: 18,
      maxX: 558,
      minY: 34,
      maxY: 244,
      centerX: 288,
      centerY: 144,
      pixelRadius: 112,
    } as const;
    const labels = layoutMapLabels(candidates, CENTER, {
      viewport,
      radiusMeters: 500,
      maximumLabels: 18,
    });

    expect(labels.length).toBeGreaterThan(MAX_VISIBLE_MAP_LABELS);
    for (const label of labels) {
      expect(label.x).toBeGreaterThanOrEqual(viewport.minX);
      expect(label.x + label.width).toBeLessThanOrEqual(viewport.maxX);
      expect(label.y).toBeGreaterThanOrEqual(viewport.minY);
      expect(label.y + label.height).toBeLessThanOrEqual(viewport.maxY);
    }
    const east = [{
      kind: "road" as const,
      name: "EAST",
      point: coordinateAt(220, 90),
    }];
    const far = layoutMapLabels(east, CENTER, {
      viewport,
      radiusMeters: 650,
    })[0];
    const close = layoutMapLabels(east, CENTER, {
      viewport,
      radiusMeters: 500,
    })[0];
    expect(close.x).toBeGreaterThan(far.x);
  });
});
