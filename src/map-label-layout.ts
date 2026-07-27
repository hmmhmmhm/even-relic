import type { Coordinate, MapLabel } from "./live-state";
import { projectCoordinate } from "./map";

export const MAX_VISIBLE_MAP_LABELS = 10;

const VIEWPORT = {
  minX: 18,
  maxX: 270,
  minY: 34,
  maxY: 244,
} as const;
const ARROW_EXCLUSION = {
  left: 128,
  top: 126,
  right: 160,
  bottom: 162,
} as const;
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
  readonly fontSize: 8 | 9;
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

function estimateWidth(text: string, fontSize: 8 | 9): number {
  return [...text].reduce(
    (sum, character) =>
      sum + (/^[\x00-\x7F]$/.test(character) ? 5 : fontSize),
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
): readonly PositionedMapLabel[] {
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
    const fontSize = prominent ? 9 : 8;
    const text = truncateMapLabel(label.name, prominent ? 16 : 14);
    const width = estimateWidth(text, fontSize);
    const height = fontSize + 2;
    const anchor = projectCoordinate(label.point, center);
    const positioned: PositionedMapLabel = {
      kind: label.kind,
      text,
      x: Math.round(clamp(
        anchor.x - width / 2,
        VIEWPORT.minX,
        VIEWPORT.maxX - width,
      )),
      y: Math.round(clamp(
        anchor.y - height / 2,
        VIEWPORT.minY,
        VIEWPORT.maxY - height,
      )),
      width,
      height,
      fontSize,
    };
    const box = collisionBox(positioned);
    if (
      intersects(box, ARROW_EXCLUSION)
      || boxes.some((acceptedBox) => intersects(box, acceptedBox))
    ) {
      continue;
    }
    accepted.push(positioned);
    boxes.push(box);
    if (accepted.length >= MAX_VISIBLE_MAP_LABELS) break;
  }

  return accepted;
}
