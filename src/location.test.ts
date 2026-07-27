import {
  AppLocationAccuracy,
  type AppLocation,
  type AppLocationOptions,
} from "@evenrealities/even_hub_sdk";
import { describe, expect, it } from "vitest";
import { DEMO_COORDINATE } from "./live-state";
import {
  LOCATION_CACHE_MAX_AGE_MS,
  resolveInitialLocation,
  type LocationBridge,
  type LocationCache,
} from "./location";

class TestLocationBridge implements LocationBridge {
  readonly values = new Map<string, string>();
  readonly reads: string[] = [];
  readonly writes: Array<[string, string]> = [];
  readonly locationOptions: Array<AppLocationOptions | undefined> = [];

  constructor(
    private readonly resolveLocation: () => Promise<AppLocation | null>,
    private readonly storageBehavior: "working" | "read-fails" | "write-fails" =
      "working",
  ) {}

  async getAppLocation(options?: AppLocationOptions): Promise<AppLocation | null> {
    this.locationOptions.push(options);
    return this.resolveLocation();
  }

  async getLocalStorage(key: string): Promise<string> {
    this.reads.push(key);
    if (this.storageBehavior === "read-fails") {
      throw new Error("read failed");
    }
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    if (this.storageBehavior === "write-fails") {
      throw new Error("write failed");
    }
    this.values.set(key, value);
    return true;
  }
}

function bridgeReturning(
  location: AppLocation | null,
  storageBehavior?: "working" | "read-fails" | "write-fails",
): TestLocationBridge {
  return new TestLocationBridge(async () => location, storageBehavior);
}

function setLocationCache(bridge: TestLocationBridge, cache: unknown): void {
  bridge.values.set("relic:location:v1", JSON.stringify(cache));
}

describe("resolveInitialLocation", () => {
  it("resolves one live location with the exact SDK options and persists it", async () => {
    const now = 1_800_000_000_000;
    const timestamp = now - 1_000;
    const bridge = bridgeReturning({
      latitude: 37.5665,
      longitude: 126.978,
      accuracy: 4,
      altitude: 32,
      heading: 90,
      speed: 1.2,
      timestamp,
    });

    await expect(resolveInitialLocation(bridge, now)).resolves.toEqual({
      status: "fresh",
      value: {
        coordinate: { latitude: 37.5665, longitude: 126.978 },
        source: "live",
        accuracy: 4,
        heading: 90,
        speed: 1.2,
      },
      fetchedAt: timestamp,
    });

    expect(bridge.locationOptions).toEqual([
      {
        accuracy: AppLocationAccuracy.Medium,
        timeoutMs: 5_000,
      },
    ]);
    expect(bridge.writes).toEqual([
      [
        "relic:location:v1",
        JSON.stringify({
          value: {
            coordinate: { latitude: 37.5665, longitude: 126.978 },
            source: "live",
            accuracy: 4,
            heading: 90,
            speed: 1.2,
          },
          fetchedAt: timestamp,
        }),
      ],
    ]);
    expect(bridge.reads).toEqual([]);
  });

  it("falls back from a null live result to a valid cache", async () => {
    const now = 1_800_000_000_000;
    const fetchedAt = now - 60_000;
    const bridge = bridgeReturning(null);
    const cache: LocationCache = {
      value: {
        coordinate: { latitude: 35.1796, longitude: 129.0756 },
        source: "live",
        accuracy: 7,
      },
      fetchedAt,
    };
    setLocationCache(bridge, cache);

    await expect(resolveInitialLocation(bridge, now)).resolves.toEqual({
      status: "stale",
      value: {
        coordinate: { latitude: 35.1796, longitude: 129.0756 },
        source: "cache",
        accuracy: 7,
      },
      fetchedAt,
    });
    expect(bridge.locationOptions).toHaveLength(1);
    expect(bridge.reads).toEqual(["relic:location:v1"]);
  });

  it("falls back from a thrown SDK error to a valid cache", async () => {
    const now = 1_800_000_000_000;
    const bridge = new TestLocationBridge(async () => {
      throw new Error("location unavailable");
    });
    setLocationCache(bridge, {
      value: {
        coordinate: { latitude: 37.4563, longitude: 126.7052 },
        source: "live",
        heading: 180,
      },
      fetchedAt: now - 10_000,
    });

    await expect(resolveInitialLocation(bridge, now)).resolves.toMatchObject({
      status: "stale",
      value: {
        coordinate: { latitude: 37.4563, longitude: 126.7052 },
        source: "cache",
        heading: 180,
      },
      fetchedAt: now - 10_000,
    });
    expect(bridge.locationOptions).toHaveLength(1);
  });

  it("uses an unavailable demo value when neither live nor cache exists", async () => {
    const bridge = bridgeReturning(null);

    await expect(
      resolveInitialLocation(bridge, 1_800_000_000_000),
    ).resolves.toEqual({
      status: "unavailable",
      value: {
        coordinate: { latitude: 37.5563, longitude: 126.922 },
        source: "demo",
      },
    });
    expect(bridge.writes).toEqual([]);
  });

  it.each([
    { latitude: 91, longitude: 127 },
    { latitude: -91, longitude: 127 },
    { latitude: 37.5, longitude: 181 },
    { latitude: 37.5, longitude: -181 },
    { latitude: Number.NaN, longitude: 127 },
    { latitude: 37.5, longitude: Number.POSITIVE_INFINITY },
  ])("rejects invalid live coordinates: %o", async (coordinate) => {
    const bridge = bridgeReturning(coordinate);

    const result = await resolveInitialLocation(bridge, 1_800_000_000_000);

    expect(result).toEqual({
      status: "unavailable",
      value: {
        coordinate: { ...DEMO_COORDINATE },
        source: "demo",
      },
    });
    expect(bridge.locationOptions).toHaveLength(1);
    expect(bridge.writes).toEqual([]);
  });

  it("uses a valid cache when the live coordinate is invalid", async () => {
    const now = 1_800_000_000_000;
    const bridge = bridgeReturning({ latitude: 90.1, longitude: 127 });
    setLocationCache(bridge, {
      value: {
        coordinate: { latitude: 33.4996, longitude: 126.5312 },
        source: "live",
      },
      fetchedAt: now,
    });

    await expect(resolveInitialLocation(bridge, now)).resolves.toMatchObject({
      status: "stale",
      value: {
        coordinate: { latitude: 33.4996, longitude: 126.5312 },
        source: "cache",
      },
    });
  });

  it("accepts a cache exactly seven days old and rejects timestamps outside the valid window", async () => {
    const now = 1_800_000_000_000;
    const boundaryBridge = bridgeReturning(null);
    setLocationCache(boundaryBridge, {
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "live",
      },
      fetchedAt: now - LOCATION_CACHE_MAX_AGE_MS,
    });
    const expiredBridge = bridgeReturning(null);
    setLocationCache(expiredBridge, {
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "live",
      },
      fetchedAt: now - LOCATION_CACHE_MAX_AGE_MS - 1,
    });
    const futureBridge = bridgeReturning(null);
    setLocationCache(futureBridge, {
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "live",
      },
      fetchedAt: now + 1,
    });

    await expect(
      resolveInitialLocation(boundaryBridge, now),
    ).resolves.toMatchObject({
      status: "stale",
      fetchedAt: now - LOCATION_CACHE_MAX_AGE_MS,
    });
    await expect(resolveInitialLocation(expiredBridge, now)).resolves.toEqual({
      status: "unavailable",
      value: {
        coordinate: { ...DEMO_COORDINATE },
        source: "demo",
      },
    });
    await expect(resolveInitialLocation(futureBridge, now)).resolves.toEqual({
      status: "unavailable",
      value: {
        coordinate: { ...DEMO_COORDINATE },
        source: "demo",
      },
    });
  });

  it.each([
    {
      value: {
        coordinate: { latitude: 37.5, longitude: 181 },
        source: "live",
      },
      fetchedAt: 1_800_000_000_000,
    },
    {
      value: {
        coordinate: { latitude: null, longitude: 127 },
        source: "live",
      },
      fetchedAt: 1_800_000_000_000,
    },
    {
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "unknown",
      },
      fetchedAt: 1_800_000_000_000,
    },
    {
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "demo",
      },
      fetchedAt: 1_800_000_000_000,
    },
    {
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "cache",
      },
      fetchedAt: 1_800_000_000_000,
    },
    {
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "live",
      },
      fetchedAt: "not-a-number",
    },
  ])("rejects malformed or non-live cached location data: %o", async (cache) => {
    const bridge = bridgeReturning(null);
    setLocationCache(bridge, cache);

    await expect(
      resolveInitialLocation(bridge, 1_800_000_000_000),
    ).resolves.toMatchObject({
      status: "unavailable",
      value: { source: "demo" },
    });
  });

  it.each([
    ["accuracy", -1],
    ["accuracy", Number.NaN],
    ["heading", -1],
    ["heading", 360],
    ["speed", -1],
    ["speed", Number.POSITIVE_INFINITY],
  ] as const)("omits invalid live %s telemetry: %s", async (field, invalid) => {
    const now = 1_800_000_000_000;
    const bridge = bridgeReturning({
      latitude: 37.5,
      longitude: 127,
      [field]: invalid,
    });

    await expect(resolveInitialLocation(bridge, now)).resolves.toEqual({
      status: "fresh",
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "live",
      },
      fetchedAt: now,
    });
  });

  it("restores a valid cached coordinate while omitting invalid telemetry", async () => {
    const now = 1_800_000_000_000;
    const bridge = bridgeReturning(null);
    setLocationCache(bridge, {
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "live",
        accuracy: -1,
        heading: 360,
        speed: null,
      },
      fetchedAt: now,
    });

    await expect(resolveInitialLocation(bridge, now)).resolves.toEqual({
      status: "stale",
      value: {
        coordinate: { latitude: 37.5, longitude: 127 },
        source: "cache",
      },
      fetchedAt: now,
    });
  });

  it.each([
    [Number.NaN, 1_800_000_000_000],
    [1_800_000_000_001, 1_800_000_000_000],
    [
      1_800_000_000_000 - LOCATION_CACHE_MAX_AGE_MS - 1,
      1_800_000_000_000,
    ],
    [1_800_000_000_000, 1_800_000_000_000],
    [
      1_800_000_000_000 - LOCATION_CACHE_MAX_AGE_MS,
      1_800_000_000_000 - LOCATION_CACHE_MAX_AGE_MS,
    ],
  ])("normalizes live timestamp %s to %s", async (timestamp, fetchedAt) => {
    const now = 1_800_000_000_000;
    const bridge = bridgeReturning({
      latitude: 37.5,
      longitude: 127,
      timestamp,
    });

    await expect(resolveInitialLocation(bridge, now)).resolves.toMatchObject({
      status: "fresh",
      fetchedAt,
    });
  });

  it("does not throw when cache persistence fails", async () => {
    const bridge = bridgeReturning(
      { latitude: 37.5, longitude: 127 },
      "write-fails",
    );

    await expect(
      resolveInitialLocation(bridge, 1_800_000_000_000),
    ).resolves.toMatchObject({
      status: "fresh",
      value: { source: "live" },
    });
    expect(bridge.writes).toHaveLength(1);
  });

  it("does not throw when cache reading fails", async () => {
    const bridge = bridgeReturning(null, "read-fails");

    await expect(
      resolveInitialLocation(bridge, 1_800_000_000_000),
    ).resolves.toMatchObject({
      status: "unavailable",
      value: { source: "demo" },
    });
    expect(bridge.reads).toEqual(["relic:location:v1"]);
  });

  it("returns a fresh demo coordinate that cannot mutate the global default", async () => {
    const first = await resolveInitialLocation(
      bridgeReturning(null),
      1_800_000_000_000,
    );
    const coordinate = first.value?.coordinate as {
      latitude: number;
      longitude: number;
    };
    coordinate.latitude = 0;

    const second = await resolveInitialLocation(
      bridgeReturning(null),
      1_800_000_000_000,
    );

    expect(first.value?.coordinate).not.toBe(DEMO_COORDINATE);
    expect(second.value?.coordinate).not.toBe(first.value?.coordinate);
    expect(second.value?.coordinate).toEqual(DEMO_COORDINATE);
    expect(DEMO_COORDINATE.latitude).toBe(37.5563);
  });
});
