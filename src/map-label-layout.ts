import type { Coordinate, MapLabel } from "./live-state";
import { projectCoordinate } from "./map";

export const MAX_VISIBLE_MAP_LABELS = 10;

export type MapLabelViewport = {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly pixelRadius: number;
};

type MapLabelLayoutOptions = {
  readonly viewport?: MapLabelViewport;
  readonly radiusMeters?: number;
  readonly maximumLabels?: number;
};

const DEFAULT_VIEWPORT: MapLabelViewport = {
  minX: 18,
  maxX: 270,
  minY: 34,
  maxY: 244,
  centerX: 144,
  centerY: 144,
  pixelRadius: 112,
};
const COLLISION_SPACE = 4;
const PRIORITY: Readonly<Record<MapLabel["kind"], number>> = {
  transit: 0,
  place: 1,
  road: 2,
  landmark: 3,
};

type Box = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type PositionedMapLabel = {
  readonly kind: MapLabel["kind"];
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: 12 | 14;
};

function hudUnits(value: string): number {
  return [...value].reduce(
    (total, character) =>
      total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2),
    0,
  );
}

export function truncateMapLabel(
  value: string,
  maximumUnits: number,
): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (hudUnits(normalized) <= maximumUnits) return normalized;

  const ellipsisUnits = 2;
  let output = "";
  let used = 0;
  for (const character of normalized) {
    const units = /^[\x00-\x7F]$/.test(character) ? 1 : 2;
    if (used + units + ellipsisUnits > maximumUnits) break;
    output += character;
    used += units;
  }
  return `${output.trimEnd()}…`;
}

function estimateWidth(text: string, fontSize: 12 | 14): number {
  const asciiWidth = Math.ceil(fontSize * 5 / 8);
  return [...text].reduce(
    (sum, character) =>
      sum + (/^[\x00-\x7F]$/.test(character) ? asciiWidth : fontSize),
    0,
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function collisionBox(label: PositionedMapLabel): Box {
  return {
    left: label.x - COLLISION_SPACE,
    top: label.y - COLLISION_SPACE,
    right: label.x + label.width + COLLISION_SPACE,
    bottom: label.y + label.height + COLLISION_SPACE,
  };
}

function intersects(left: Box, right: Box): boolean {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

export function layoutMapLabels(
  labels: readonly MapLabel[],
  center: Coordinate,
  options: MapLabelLayoutOptions = {},
): readonly PositionedMapLabel[] {
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;
  const radiusMeters = options.radiusMeters ?? 650;
  const maximumLabels = options.maximumLabels ?? MAX_VISIBLE_MAP_LABELS;
  const arrowExclusion = {
    left: viewport.centerX - 16,
    top: viewport.centerY - 18,
    right: viewport.centerX + 16,
    bottom: viewport.centerY + 18,
  };
  const candidates = labels
    .map((label, sourceIndex) => ({ label, sourceIndex }))
    .sort(
      (left, right) =>
        PRIORITY[left.label.kind] - PRIORITY[right.label.kind]
        || left.sourceIndex - right.sourceIndex,
    );
  const accepted: PositionedMapLabel[] = [];
  const boxes: Box[] = [];

  for (const { label } of candidates) {
    const prominent = label.kind === "transit" || label.kind === "place";
    const fontSize = prominent ? 14 : 12;
    const text = truncateMapLabel(label.name, prominent ? 16 : 14);
    const width = estimateWidth(text, fontSize);
    const height = fontSize + 2;
    const projected = projectCoordinate(label.point, center, radiusMeters);
    const anchor = {
      x: viewport.centerX
        + (projected.x - 144) * viewport.pixelRadius / 112,
      y: viewport.centerY
        + (projected.y - 144) * viewport.pixelRadius / 112,
    };
    const positioned: PositionedMapLabel = {
      kind: label.kind,
      text,
      x: Math.round(clamp(
        anchor.x - width / 2,
        viewport.minX,
        viewport.maxX - width,
      )),
      y: Math.round(clamp(
        anchor.y - height / 2,
        viewport.minY,
        viewport.maxY - height,
      )),
      width,
      height,
      fontSize,
    };
    const box = collisionBox(positioned);
    if (
      intersects(box, arrowExclusion)
      || boxes.some((acceptedBox) => intersects(box, acceptedBox))
    ) {
      continue;
    }
    accepted.push(positioned);
    boxes.push(box);
    if (accepted.length >= maximumLabels) break;
  }

  return accepted;
}
