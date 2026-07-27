import { readCache, writeCache, type EvenStorage } from "./live-cache";
import type {
  Coordinate,
  DataState,
  MapRoad,
  MapValue,
} from "./live-state";

export const MAP_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const MAP_RADIUS_METERS = 650;

const MAP_TIMEOUT_MS = 8_000;
const MAP_MAX_ROADS = 180;
const MAP_MAX_POINTS = 4_000;

type MapCache = {
  readonly value: MapValue;
  readonly fetchedAt: number;
  readonly cell: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteCoordinate(value: unknown): value is Coordinate {
  return isRecord(value)
    && typeof value.latitude === "number"
    && Number.isFinite(value.latitude)
    && value.latitude >= -90
    && value.latitude <= 90
    && typeof value.longitude === "number"
    && Number.isFinite(value.longitude)
    && value.longitude >= -180
    && value.longitude <= 180;
}

function isMapRoad(value: unknown): value is MapRoad {
  return isRecord(value)
    && (value.kind === "major" || value.kind === "minor")
    && Array.isArray(value.points)
    && value.points.length >= 2
    && value.points.every(isFiniteCoordinate);
}

function isMapValue(value: unknown): value is MapValue {
  if (
    !isRecord(value)
    || value.attribution !== "© OSM CONTRIBUTORS"
    || typeof value.cell !== "string"
    || !Array.isArray(value.roads)
    || value.roads.length > MAP_MAX_ROADS
    || !value.roads.every(isMapRoad)
  ) {
    return false;
  }
  return value.roads.reduce(
    (total, road) => total + road.points.length,
    0,
  ) <= MAP_MAX_POINTS;
}

function isMapCache(value: unknown): value is MapCache {
  return isRecord(value)
    && isMapValue(value.value)
    && typeof value.fetchedAt === "number"
    && Number.isFinite(value.fetchedAt)
    && typeof value.cell === "string"
    && value.cell === value.value.cell;
}

function cloneMapValue(value: MapValue): MapValue {
  return {
    cell: value.cell,
    attribution: "© OSM CONTRIBUTORS",
    roads: value.roads.map((road) => ({
      kind: road.kind,
      points: road.points.map((point) => ({ ...point })),
    })),
  };
}

function mapState(
  cache: MapCache,
  status: "fresh" | "stale",
): DataState<MapValue> {
  return {
    status,
    value: cloneMapValue(cache.value),
    fetchedAt: cache.fetchedAt,
  };
}

export function clientMapCell(coordinate: Coordinate): string {
  const latitude = Math.floor(coordinate.latitude / 0.005) * 0.005;
  const longitude = Math.floor(coordinate.longitude / 0.005) * 0.005;
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

export function parseMapResponse(input: unknown): MapValue {
  if (
    !isRecord(input)
    || input.attribution !== "© OSM CONTRIBUTORS"
    || typeof input.cell !== "string"
    || !Array.isArray(input.roads)
    || input.roads.length > MAP_MAX_ROADS
  ) {
    throw new Error("Invalid map response");
  }

  let totalPoints = 0;
  const roads: MapRoad[] = input.roads.map((road) => {
    if (
      !isRecord(road)
      || (road.kind !== "major" && road.kind !== "minor")
      || !Array.isArray(road.points)
      || road.points.length < 2
    ) {
      throw new Error("Invalid map road");
    }
    const points = road.points.map((point) => {
      if (!Array.isArray(point) || point.length !== 2) {
        throw new Error("Invalid map point");
      }
      const coordinate = {
        latitude: point[0],
        longitude: point[1],
      };
      if (!isFiniteCoordinate(coordinate)) {
        throw new Error("Invalid map coordinate");
      }
      return coordinate;
    });
    totalPoints += points.length;
    if (totalPoints > MAP_MAX_POINTS) {
      throw new Error("Map response has too many points");
    }
    return { kind: road.kind, points };
  });

  return {
    cell: input.cell,
    attribution: "© OSM CONTRIBUTORS",
    roads,
  };
}

export function projectCoordinate(
  point: Coordinate,
  center: Coordinate,
  radiusMeters = MAP_RADIUS_METERS,
): { readonly x: number; readonly y: number } {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new Error("Invalid map radius");
  }
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude = 111_320 * Math.cos(
    center.latitude * Math.PI / 180,
  );
  const east = (
    point.longitude - center.longitude
  ) * metersPerDegreeLongitude;
  const north = (
    point.latitude - center.latitude
  ) * metersPerDegreeLatitude;
  const scale = 112 / radiusMeters;
  return {
    x: 144 + east * scale,
    y: 144 - north * scale,
  };
}

export async function resolveMap(
  storage: EvenStorage,
  coordinate: Coordinate,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
  onCached?: (cached: DataState<MapValue>) => void,
): Promise<DataState<MapValue>> {
  const requestCoordinate = { ...coordinate };
  const cell = clientMapCell(requestCoordinate);
  const cached = await readCache(storage, "map", isMapCache);
  const usableCache = cached
    && cached.fetchedAt <= now
    && cached.cell === cell
    ? cached
    : undefined;
  if (usableCache) {
    const status = now - usableCache.fetchedAt <= MAP_MAX_AGE_MS
      ? "fresh"
      : "stale";
    const cachedState = mapState(usableCache, status);
    try {
      onCached?.(cachedState);
    } catch {
      // Rendering cached geometry is optional and must not stop refresh.
    }
    if (status === "fresh") return cachedState;
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    MAP_TIMEOUT_MS,
  );
  try {
    const response = await fetchImpl(
      `/api/map?lat=${encodeURIComponent(requestCoordinate.latitude)}` +
      `&lng=${encodeURIComponent(requestCoordinate.longitude)}`,
      {
        headers: { accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("MAP_HTTP_ERROR");
    const value = parseMapResponse(await response.json());
    if (value.cell !== cell) throw new Error("MAP_CELL_MISMATCH");

    const cache: MapCache = {
      value: cloneMapValue(value),
      fetchedAt: now,
      cell,
    };
    await writeCache(storage, "map", cache);
    return {
      status: "fresh",
      value: cloneMapValue(value),
      fetchedAt: now,
    };
  } catch {
    return usableCache
      ? mapState(usableCache, "stale")
      : { status: "unavailable" };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
