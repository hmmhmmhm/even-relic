import type {
  Coordinate,
  DataState,
  LiveDashboardState,
  LocationValue,
  MapValue,
  RouteValue,
} from "./live-state";
import { projectCoordinate } from "./map";
import {
  layoutMapLabels,
  type MapLabelViewport,
} from "./map-label-layout";

const COLOR = {
  background: "#000000",
  primary: "#ffffff",
  secondary: "#d0d0d0",
  dim: "#808080",
} as const;
export const EMBEDDED_MAP_VIEWPORT: MapLabelViewport = {
  minX: 18,
  maxX: 270,
  minY: 34,
  maxY: 244,
  centerX: 144,
  centerY: 144,
  pixelRadius: 112,
};
export const FULLSCREEN_MAP_VIEWPORT: MapLabelViewport = {
  minX: 18,
  maxX: 558,
  minY: 34,
  maxY: 244,
  centerX: 288,
  centerY: 144,
  pixelRadius: 112,
};

type Point = readonly [number, number];
type HudColor = typeof COLOR[keyof typeof COLOR];

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: HudColor = COLOR.primary,
  weight: "normal" | "bold" = "normal",
) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px "SFMono-Regular", Consolas, monospace`;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(value, x, y);
}

function drawPath(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
  width: number,
) {
  const [first, ...rest] = points;
  if (!first || rest.length === 0) return;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "square";
  context.lineJoin = "miter";
  context.stroke();
}

function fillPolygon(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
) {
  const [first, ...rest] = points;
  if (!first) return;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawFrame(context: CanvasRenderingContext2D) {
  const x = 8;
  const y = 8;
  const width = 272;
  const height = 272;
  const corner = 18;
  const right = x + width;
  const bottom = y + height;
  context.fillStyle = COLOR.dim;
  context.fillRect(x, y, corner, 1);
  context.fillRect(x, y, 1, corner);
  context.fillRect(right - corner, y, corner, 1);
  context.fillRect(right - 1, y, 1, corner);
  context.fillRect(x, bottom - 1, corner, 1);
  context.fillRect(x, bottom - corner, 1, corner);
  context.fillRect(right - corner, bottom - 1, corner, 1);
  context.fillRect(right - 1, bottom - corner, 1, corner);
  context.fillStyle = COLOR.primary;
  context.fillRect(x, y, 10, 2);
}

function clamped(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function projected(
  point: Coordinate,
  center: Coordinate,
  viewport: MapLabelViewport,
  radiusMeters: number,
): Point {
  const output = projectCoordinate(point, center, radiusMeters);
  return [
    clamped(
      viewport.centerX
        + (output.x - 144) * viewport.pixelRadius / 112,
      viewport.minX,
      viewport.maxX,
    ),
    clamped(
      viewport.centerY
        + (output.y - 144) * viewport.pixelRadius / 112,
      viewport.minY,
      viewport.maxY,
    ),
  ];
}

function mapDescriptor(
  location: DataState<LocationValue>,
  map: DataState<MapValue>,
) {
  const source = location.value?.source === "live"
    ? "LIVE"
    : location.value?.source === "cache"
      ? "LAST FIX"
      : "DEMO";
  const layer = map.status === "fresh" || map.status === "stale"
    ? map.status === "stale" ? "OSM LAST" : "OSM"
    : "SCHEMATIC";
  return { source, layer };
}

function mapHeader(
  location: DataState<LocationValue>,
  map: DataState<MapValue>,
) {
  const { source, layer } = mapDescriptor(location, map);
  return `LOC // ${source} · ${layer}`;
}

function drawSchematicRoads(
  context: CanvasRenderingContext2D,
  viewport: MapLabelViewport,
) {
  const roads: readonly Point[][] = [
    [[18, 52], [78, 42], [130, 64], [202, 48], [270, 62]],
    [[18, 88], [68, 82], [126, 94], [190, 78], [270, 90]],
    [[18, 126], [76, 114], [134, 132], [198, 118], [270, 128]],
    [[18, 166], [62, 152], [126, 172], [202, 154], [270, 166]],
    [[18, 208], [82, 192], [144, 214], [214, 198], [270, 208]],
    [[46, 34], [52, 244]],
    [[108, 34], [98, 244]],
    [[172, 34], [182, 244]],
    [[234, 34], [226, 244]],
  ];
  const scaleX = (viewport.maxX - viewport.minX) / (270 - 18);
  const scaleY = (viewport.maxY - viewport.minY) / (244 - 34);
  for (const road of roads) {
    drawPath(
      context,
      road.map(([x, y]) => [
        viewport.minX + (x - 18) * scaleX,
        viewport.minY + (y - 34) * scaleY,
      ]),
      COLOR.dim,
      1,
    );
  }
}

function drawRoads(
  context: CanvasRenderingContext2D,
  map: MapValue,
  center: Coordinate,
  viewport: MapLabelViewport,
  radiusMeters: number,
) {
  for (const kind of ["minor", "major"] as const) {
    for (const road of map.roads) {
      if (road.kind !== kind) continue;
      drawPath(
        context,
        road.points.map(
          (point) => projected(point, center, viewport, radiusMeters),
        ),
        kind === "minor" ? COLOR.dim : COLOR.secondary,
        kind === "minor" ? 1 : 2,
      );
    }
  }
}

function drawMapLabels(
  context: CanvasRenderingContext2D,
  map: MapValue,
  center: Coordinate,
  viewport: MapLabelViewport,
  radiusMeters: number,
  maximumLabels: number,
) {
  for (const label of layoutMapLabels(map.labels, center, {
    viewport,
    radiusMeters,
    maximumLabels,
  })) {
    context.fillStyle = COLOR.background;
    context.fillRect(
      label.x - 2,
      label.y - 1,
      label.width + 4,
      label.height + 2,
    );
    drawText(
      context,
      label.text,
      label.x,
      label.y,
      label.fontSize,
      label.kind === "transit" || label.kind === "place"
        ? COLOR.primary
        : COLOR.secondary,
      "bold",
    );
  }
}

function activeRoute(
  route: DataState<RouteValue>,
): RouteValue | undefined {
  return route.status === "fresh" || route.status === "stale"
    ? route.value
    : undefined;
}

function drawRoute(
  context: CanvasRenderingContext2D,
  route: RouteValue,
  center: Coordinate,
  viewport: MapLabelViewport,
  radiusMeters: number,
) {
  const points = route.geometry.map(
    (point) => projected(point, center, viewport, radiusMeters),
  );
  drawPath(context, points, COLOR.secondary, 6);
  drawPath(context, points, COLOR.primary, 3);
}

function drawPositionArrow(
  context: CanvasRenderingContext2D,
  viewport: MapLabelViewport,
  heading = 0,
) {
  const angle = Number.isFinite(heading) ? heading * Math.PI / 180 : 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const points: readonly Point[] = [
    [0, -14],
    [7, 8],
    [0, 4],
    [-7, 8],
  ];
  fillPolygon(
    context,
    points.map(([x, y]) => [
      viewport.centerX + x * cosine - y * sine,
      viewport.centerY + x * sine + y * cosine,
    ]),
    COLOR.primary,
  );
}

function drawFooter(
  context: CanvasRenderingContext2D,
  map: DataState<MapValue>,
  route: DataState<RouteValue>,
  radiusMeters: number,
) {
  context.fillStyle = COLOR.background;
  context.fillRect(12, 250, 264, 25);
  context.fillStyle = COLOR.dim;
  context.fillRect(12, 249, 264, 1);
  const active = activeRoute(route);
  const status = active
    ? `ROUTE ${(active.remainingDistance / 1_000).toFixed(1)}km`
    : map.status === "fresh"
      ? "OSM LIVE"
      : map.status === "stale"
        ? "OSM LAST"
        : "SCHEMATIC";
  drawText(context, status, 18, 256, 10, COLOR.primary, "bold");
  drawText(
    context,
    `Z // ${radiusMeters}m`,
    94,
    257,
    8,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    "© OSM CONTRIBUTORS",
    154,
    257,
    8,
    COLOR.secondary,
    "bold",
  );
}

function drawMapLayers(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
  viewport: MapLabelViewport,
  radiusMeters: number,
  maximumLabels: number,
) {
  const center = live.location.value?.coordinate;
  const map = live.map.status === "fresh" || live.map.status === "stale"
    ? live.map.value
    : undefined;
  if (center && map) {
    drawRoads(context, map, center, viewport, radiusMeters);
    drawMapLabels(
      context,
      map,
      center,
      viewport,
      radiusMeters,
      maximumLabels,
    );
  } else {
    drawSchematicRoads(context, viewport);
  }

  const route = activeRoute(live.route);
  if (center && route) {
    drawRoute(context, route, center, viewport, radiusMeters);
  }
  drawPositionArrow(context, viewport, live.location.value?.heading);
}

export function drawFastMap(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
  radiusMeters = 650,
) {
  drawFrame(context);
  drawText(
    context,
    mapHeader(live.location, live.map),
    18,
    16,
    11,
    COLOR.secondary,
    "bold",
  );
  drawMapLayers(
    context,
    live,
    EMBEDDED_MAP_VIEWPORT,
    radiusMeters,
    10,
  );
  drawFooter(context, live.map, live.route, radiusMeters);
}

function drawFullscreenHeader(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
  radiusMeters: number,
) {
  const { source, layer } = mapDescriptor(live.location, live.map);
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, 576, 31);
  context.fillStyle = COLOR.dim;
  context.fillRect(0, 30, 576, 1);
  drawText(
    context,
    `MAP // ${source} · ${layer}`,
    14,
    8,
    12,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    `ZOOM // ${radiusMeters}m`,
    444,
    8,
    12,
    COLOR.secondary,
    "bold",
  );
}

function drawFullscreenFooter(context: CanvasRenderingContext2D) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 254, 576, 34);
  context.fillStyle = COLOR.dim;
  context.fillRect(0, 253, 576, 1);
  drawText(
    context,
    "© OSM CONTRIBUTORS",
    14,
    264,
    9,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    "DOUBLE TAP // BACK",
    400,
    264,
    9,
    COLOR.primary,
    "bold",
  );
}

export function drawFastFullscreenMap(
  canvas: HTMLCanvasElement,
  live: LiveDashboardState,
  radiusMeters: number,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");
  canvas.width = 576;
  canvas.height = 288;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, 576, 288);
  drawMapLayers(
    context,
    live,
    FULLSCREEN_MAP_VIEWPORT,
    radiusMeters,
    18,
  );
  drawFullscreenHeader(context, live, radiusMeters);
  drawFullscreenFooter(context);
}
