import {
  AppLocationAccuracy,
  type AppLocation,
  type AppLocationOptions,
} from "@evenrealities/even_hub_sdk";
import { readCache, writeCache, type EvenStorage } from "./live-cache";
import {
  DEMO_COORDINATE,
  type DataState,
  type LocationValue,
} from "./live-state";

export type LocationBridge = EvenStorage & {
  getAppLocation(options?: AppLocationOptions): Promise<AppLocation | null>;
};

export type LocationCache = {
  readonly value: LocationValue;
  readonly fetchedAt: number;
};

export const LOCATION_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCoordinate(
  value: unknown,
): value is { latitude: number; longitude: number } {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    isFiniteNumber(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function hasValidOptionalNumber(
  value: Record<string, unknown>,
  key: "accuracy" | "heading" | "speed",
): boolean {
  return !(key in value) || isFiniteNumber(value[key]);
}

function isLocationSource(
  value: unknown,
): value is LocationValue["source"] {
  return value === "live" || value === "cache" || value === "demo";
}

function isLocationValue(value: unknown): value is LocationValue {
  return (
    isRecord(value) &&
    isCoordinate(value.coordinate) &&
    isLocationSource(value.source) &&
    hasValidOptionalNumber(value, "accuracy") &&
    hasValidOptionalNumber(value, "heading") &&
    hasValidOptionalNumber(value, "speed")
  );
}

function isLocationCache(value: unknown): value is LocationCache {
  return (
    isRecord(value) &&
    isLocationValue(value.value) &&
    isFiniteNumber(value.fetchedAt)
  );
}

function normalizeLocationValue(
  location: AppLocation,
  source: LocationValue["source"],
): LocationValue {
  return {
    coordinate: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    source,
    ...(isFiniteNumber(location.accuracy)
      ? { accuracy: location.accuracy }
      : {}),
    ...(isFiniteNumber(location.heading)
      ? { heading: location.heading }
      : {}),
    ...(isFiniteNumber(location.speed) ? { speed: location.speed } : {}),
  };
}

function normalizeCachedValue(value: LocationValue): LocationValue {
  return {
    coordinate: { ...value.coordinate },
    source: "cache",
    ...(isFiniteNumber(value.accuracy) ? { accuracy: value.accuracy } : {}),
    ...(isFiniteNumber(value.heading) ? { heading: value.heading } : {}),
    ...(isFiniteNumber(value.speed) ? { speed: value.speed } : {}),
  };
}

function demoLocation(): DataState<LocationValue> {
  return {
    status: "unavailable",
    value: {
      coordinate: { ...DEMO_COORDINATE },
      source: "demo",
    },
  };
}

export async function resolveInitialLocation(
  bridge: LocationBridge,
  now = Date.now(),
): Promise<DataState<LocationValue>> {
  let liveLocation: AppLocation | null = null;

  try {
    liveLocation = await bridge.getAppLocation({
      accuracy: AppLocationAccuracy.Medium,
      timeoutMs: 5_000,
    });
  } catch {
    liveLocation = null;
  }

  if (isCoordinate(liveLocation)) {
    const value = normalizeLocationValue(liveLocation, "live");
    const fetchedAt = isFiniteNumber(liveLocation.timestamp)
      ? liveLocation.timestamp
      : now;
    await writeCache<LocationCache>(bridge, "location", {
      value,
      fetchedAt,
    });

    return {
      status: "fresh",
      value,
      fetchedAt,
    };
  }

  const cached = await readCache(bridge, "location", isLocationCache);
  if (
    cached &&
    cached.fetchedAt <= now &&
    now - cached.fetchedAt <= LOCATION_CACHE_MAX_AGE_MS
  ) {
    return {
      status: "stale",
      value: normalizeCachedValue(cached.value),
      fetchedAt: cached.fetchedAt,
    };
  }

  return demoLocation();
}
