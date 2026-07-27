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

function isAccuracy(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isHeading(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value < 360;
}

function isSpeed(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
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

type TelemetryInput = {
  readonly accuracy?: unknown;
  readonly heading?: unknown;
  readonly speed?: unknown;
};

type LocationTelemetry = Pick<
  LocationValue,
  "accuracy" | "heading" | "speed"
>;

type CachedLiveLocation = TelemetryInput & {
  readonly coordinate: LocationValue["coordinate"];
  readonly source: "live";
};

type ValidatedLocationCache = {
  readonly value: CachedLiveLocation;
  readonly fetchedAt: number;
};

function isLocationCache(
  value: unknown,
): value is ValidatedLocationCache {
  return (
    isRecord(value) &&
    isRecord(value.value) &&
    isCoordinate(value.value.coordinate) &&
    value.value.source === "live" &&
    isFiniteNumber(value.fetchedAt)
  );
}

function normalizeTelemetry(value: TelemetryInput): LocationTelemetry {
  return {
    ...(isAccuracy(value.accuracy) ? { accuracy: value.accuracy } : {}),
    ...(isHeading(value.heading) ? { heading: value.heading } : {}),
    ...(isSpeed(value.speed) ? { speed: value.speed } : {}),
  };
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
    ...normalizeTelemetry(location),
  };
}

function normalizeCachedValue(value: CachedLiveLocation): LocationValue {
  return {
    coordinate: { ...value.coordinate },
    source: "cache",
    ...normalizeTelemetry(value),
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

function normalizeFetchedAt(timestamp: unknown, now: number): number {
  return isFiniteNumber(timestamp) &&
    timestamp >= now - LOCATION_CACHE_MAX_AGE_MS &&
    timestamp <= now
    ? timestamp
    : now;
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
    const fetchedAt = normalizeFetchedAt(liveLocation.timestamp, now);
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
