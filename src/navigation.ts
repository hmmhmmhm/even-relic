import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";
import type {
  Coordinate,
  RouteManeuver,
  RouteValue,
} from "./live-state";
import { haversineMeters } from "./location";
import type { Destination, RouteProfile } from "./routing";

export { haversineMeters };

export const ACTIVE_ROUTE_MAX_AGE_MS = 6 * 60 * 60 * 1_000;

export type ActiveRouteCache = {
  readonly destination: Destination;
  readonly route: RouteValue;
  readonly fetchedAt: number;
};

type ClosestRoutePosition = {
  readonly distance: number;
  readonly segmentIndex: number;
  readonly progress: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is Coordinate {
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

function localMeters(point: Coordinate, origin: Coordinate) {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos(
    origin.latitude * Math.PI / 180,
  );
  return {
    x: (point.longitude - origin.longitude) * longitudeScale,
    y: (point.latitude - origin.latitude) * latitudeScale,
  };
}

function closestRoutePosition(
  point: Coordinate,
  geometry: readonly Coordinate[],
): ClosestRoutePosition {
  let closest: ClosestRoutePosition = {
    distance: Number.POSITIVE_INFINITY,
    segmentIndex: 0,
    progress: 0,
  };
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = localMeters(geometry[index], point);
    const end = localMeters(geometry[index + 1], point);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const lengthSquared = deltaX ** 2 + deltaY ** 2;
    const progress = lengthSquared === 0
      ? 0
      : Math.min(
        1,
        Math.max(
          0,
          -(start.x * deltaX + start.y * deltaY) / lengthSquared,
        ),
      );
    const nearestX = start.x + deltaX * progress;
    const nearestY = start.y + deltaY * progress;
    const distance = Math.hypot(nearestX, nearestY);
    if (distance < closest.distance) {
      closest = { distance, segmentIndex: index, progress };
    }
  }
  return closest;
}

export function distanceToRouteMeters(
  point: Coordinate,
  geometry: readonly Coordinate[],
): number {
  if (geometry.length < 2) return Number.POSITIVE_INFINITY;
  return closestRoutePosition(point, geometry).distance;
}

export function distanceBucket(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  const size = distance < 200 ? 10 : distance < 1_000 ? 50 : 100;
  return Math.floor(distance / size) * size;
}

export function selectActiveManeuver(
  route: RouteValue,
  location: Coordinate,
): number {
  if (route.maneuvers.length === 0 || route.geometry.length < 2) return 0;
  const { segmentIndex } = closestRoutePosition(location, route.geometry);
  const next = route.maneuvers.findIndex(
    (maneuver) => maneuver.wayPoints[1] > segmentIndex,
  );
  return next === -1 ? route.maneuvers.length - 1 : next;
}

function remainingRouteDistance(
  geometry: readonly Coordinate[],
  position: ClosestRoutePosition,
): number {
  if (geometry.length < 2) return 0;
  const start = geometry[position.segmentIndex];
  const end = geometry[position.segmentIndex + 1];
  let remaining = haversineMeters(start, end) * (1 - position.progress);
  for (
    let index = position.segmentIndex + 1;
    index < geometry.length - 1;
    index += 1
  ) {
    remaining += haversineMeters(geometry[index], geometry[index + 1]);
  }
  return remaining;
}

export function routeProgress(
  route: RouteValue,
  location: Coordinate,
): RouteValue {
  const position = closestRoutePosition(location, route.geometry);
  return {
    ...route,
    activeManeuverIndex: selectActiveManeuver(route, location),
    remainingDistance: Math.max(
      0,
      remainingRouteDistance(route.geometry, position),
    ),
  };
}

function isProfile(value: unknown): value is RouteProfile {
  return value === "foot-walking"
    || value === "cycling-regular"
    || value === "driving-car";
}

function isManeuver(
  value: unknown,
  geometryLength: number,
): value is RouteManeuver {
  return isRecord(value)
    && typeof value.instruction === "string"
    && value.instruction.length > 0
    && typeof value.distance === "number"
    && Number.isFinite(value.distance)
    && value.distance >= 0
    && Array.isArray(value.wayPoints)
    && value.wayPoints.length === 2
    && value.wayPoints.every(
      (point) =>
        Number.isInteger(point)
        && point >= 0
        && point < geometryLength,
    );
}

function isRouteValue(value: unknown): value is RouteValue {
  if (
    !isRecord(value)
    || typeof value.destinationName !== "string"
    || value.destinationName.length === 0
    || !Array.isArray(value.geometry)
    || value.geometry.length < 2
    || !value.geometry.every(isCoordinate)
    || !Array.isArray(value.maneuvers)
    || typeof value.activeManeuverIndex !== "number"
    || !Number.isInteger(value.activeManeuverIndex)
    || value.activeManeuverIndex < 0
    || typeof value.remainingDistance !== "number"
    || !Number.isFinite(value.remainingDistance)
    || value.remainingDistance < 0
    || !isProfile(value.profile)
  ) {
    return false;
  }
  const geometryLength = value.geometry.length;
  const maneuvers = value.maneuvers;
  const activeManeuverIndex = value.activeManeuverIndex;
  return maneuvers.every(
    (maneuver) => isManeuver(maneuver, geometryLength),
  ) && (
    maneuvers.length === 0
      ? activeManeuverIndex === 0
      : activeManeuverIndex < maneuvers.length
  );
}

function isDestination(value: unknown): value is Destination {
  return isRecord(value)
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.name === "string"
    && value.name.length > 0
    && typeof value.label === "string"
    && value.label.length > 0
    && isCoordinate(value.coordinate);
}

function isActiveRouteCache(value: unknown): value is ActiveRouteCache {
  return isRecord(value)
    && isDestination(value.destination)
    && isRouteValue(value.route)
    && typeof value.fetchedAt === "number"
    && Number.isFinite(value.fetchedAt);
}

export async function readActiveRouteCache(
  storage: EvenStorage,
  now = Date.now(),
): Promise<ActiveRouteCache | undefined> {
  const cache = await readCache(
    storage,
    "active-route",
    isActiveRouteCache,
  );
  if (
    !cache
    || cache.fetchedAt > now
    || now - cache.fetchedAt > ACTIVE_ROUTE_MAX_AGE_MS
  ) {
    return undefined;
  }
  return cache;
}

export function writeActiveRouteCache(
  storage: EvenStorage,
  destination: Destination,
  route: RouteValue,
  fetchedAt = Date.now(),
): Promise<boolean> {
  return writeCache(storage, "active-route", {
    destination,
    route,
    fetchedAt,
  } satisfies ActiveRouteCache);
}

export function clearActiveRouteCache(storage: EvenStorage): Promise<boolean> {
  return clearCache(storage, "active-route");
}
