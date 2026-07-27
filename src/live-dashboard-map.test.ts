// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  AppLocationAccuracy,
  type AppLocation,
  type AppLocationOptions,
} from "@evenrealities/even_hub_sdk";
import type { LocationBridge } from "./location";
import {
  createLiveDashboardSession,
  type LiveDashboardUpdate,
} from "./live-dashboard";

const NOW = Date.parse("2026-07-27T14:20:00Z");
const LOCATION: AppLocation = {
  latitude: 37.5563,
  longitude: 126.922,
  heading: 47,
  timestamp: NOW,
};

class TestBridge implements LocationBridge {
  readonly values = new Map<string, string>();

  async getAppLocation(_options?: AppLocationOptions) {
    return LOCATION;
  }

  async getLocalStorage(key: string) {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

class StreamingBridge extends TestBridge {
  readonly startCalls: Array<AppLocationOptions | undefined> = [];
  stopCalls = 0;
  unsubscribeCalls = 0;
  private listener: ((location: AppLocation) => void) | undefined;

  constructor(
    private readonly startBehavior: "success" | "false" | "throw" = "success",
  ) {
    super();
  }

  async startAppLocationUpdates(options?: AppLocationOptions) {
    this.startCalls.push(options);
    if (this.startBehavior === "throw") {
      throw new Error("continuous location failed");
    }
    return this.startBehavior === "success";
  }

  async stopAppLocationUpdates() {
    this.stopCalls += 1;
    return true;
  }

  onAppLocationChanged(listener: (location: AppLocation) => void) {
    this.listener = listener;
    return () => {
      this.unsubscribeCalls += 1;
    };
  }

  emit(location: AppLocation) {
    this.listener?.(location);
  }
}

function weatherResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      current: {
        time: "2026-07-27T14:15",
        temperature_2m: 29,
        apparent_temperature: 31,
        relative_humidity_2m: 60,
        weather_code: 1,
        wind_speed_10m: 5,
      },
      hourly: {
        time: ["2026-07-27T14:00"],
        precipitation_probability: [10],
      },
    }),
  } as Response;
}

function newsResponse(): Response {
  return {
    ok: true,
    text: async () => `<?xml version="1.0"?>
      <rss><channel><item><title>뉴스</title><guid>one</guid></item>
      </channel></rss>`,
  } as Response;
}

function mapResponse(cell = "37.5552,126.9216"): Response {
  return {
    ok: true,
    json: async () => ({
      cell,
      attribution: "© OSM CONTRIBUTORS",
      roads: [{
        kind: "major",
        points: [[37.55, 126.91], [37.56, 126.92]],
      }],
      labels: [],
    }),
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("live dashboard map integration", () => {
  it("resolves map independently after location and emits only the left tiles", async () => {
    const updates: LiveDashboardUpdate[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/map")) return mapResponse();
      if (url.startsWith("/api/news")) return newsResponse();
      return weatherResponse();
    }) as unknown as typeof fetch;
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl,
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });

    await session.start();

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/map?lat=37.5563&lng=126.922",
      expect.objectContaining({
        headers: { accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(session.getState().map).toMatchObject({
      status: "fresh",
      value: {
        cell: "37.5552,126.9216",
        roads: [{ kind: "major" }],
      },
      fetchedAt: NOW,
    });
    const mapUpdate = [...updates].reverse().find(
      ({ state }) => state.map.status === "fresh",
    );
    expect(mapUpdate?.target).toBe("left");
  });

  it("keeps weather and news fresh when map loading fails", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/map")) {
        return { ok: false } as Response;
      }
      if (url.startsWith("/api/news")) return newsResponse();
      return weatherResponse();
    }) as unknown as typeof fetch;
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl,
      now: () => NOW,
      onUpdate: vi.fn(),
    });

    await session.start();

    expect(session.getState().map.status).toBe("stale");
    expect(session.getState().map.value).toBeDefined();
    expect(session.getState().weather.status).toBe("fresh");
    expect(session.getState().news.status).toBe("fresh");
  });

  it("does not emit a late map result after disposal", async () => {
    const map = deferred<Response>();
    const onUpdate = vi.fn();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/map")) return map.promise;
      if (url.startsWith("/api/news")) return newsResponse();
      return weatherResponse();
    }) as unknown as typeof fetch;
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl,
      now: () => NOW,
      onUpdate,
    });

    const starting = session.start();
    await vi.waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/map/),
        expect.anything(),
      );
    });
    session.dispose();
    const callsAtDispose = onUpdate.mock.calls.length;
    map.resolve(mapResponse());
    await starting;

    expect(onUpdate).toHaveBeenCalledTimes(callsAtDispose);
    expect(session.getState().map.status).toBe("loading");
  });

  it("accepts only meaningful streamed movement and stops exactly once", async () => {
    const bridge = new StreamingBridge();
    const updates: LiveDashboardUpdate[] = [];
    let currentTime = NOW;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/map")) return mapResponse();
      if (url.startsWith("/api/news")) return newsResponse();
      return weatherResponse();
    }) as unknown as typeof fetch;
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl,
      now: () => currentTime,
      onUpdate: (update) => updates.push(update),
    });
    await session.start();
    const mapCallsAtStart = vi.mocked(fetchImpl).mock.calls.filter(
      ([input]) => String(input).startsWith("/api/map"),
    ).length;
    const updatesAtStart = updates.length;

    bridge.emit({ latitude: 91, longitude: 126.922 });
    bridge.emit({ latitude: 37.55634, longitude: 126.922 });
    await Promise.resolve();
    await Promise.resolve();
    expect(updates).toHaveLength(updatesAtStart);

    currentTime = NOW + 15_000;
    bridge.emit({
      latitude: 37.55645,
      longitude: 126.922,
      heading: 50,
      timestamp: NOW + 15_000,
    });
    await vi.waitFor(() => {
      expect(session.getState().location.value?.coordinate.latitude)
        .toBe(37.55645);
    });

    expect(bridge.startCalls).toEqual([{
      accuracy: AppLocationAccuracy.Medium,
      intervalMs: 15_000,
      distanceFilter: 15,
    }]);
    expect(updates.at(-1)?.target).toBe("left");
    expect(vi.mocked(fetchImpl).mock.calls.filter(
      ([input]) => String(input).startsWith("/api/map"),
    )).toHaveLength(mapCallsAtStart);
    expect(JSON.parse(bridge.values.get("relic:location:v1") ?? "{}"))
      .toMatchObject({
        value: {
          coordinate: { latitude: 37.55645, longitude: 126.922 },
          source: "live",
        },
        fetchedAt: NOW + 15_000,
      });

    session.dispose();
    session.dispose();
    await vi.waitFor(() => expect(bridge.stopCalls).toBe(1));
    expect(bridge.unsubscribeCalls).toBe(1);
  });

  it.each(["false", "throw"] as const)(
    "keeps the one-shot fix when continuous location returns %s",
    async (startBehavior) => {
      const bridge = new StreamingBridge(startBehavior);
      const session = createLiveDashboardSession({
        bridge,
        fetchImpl: vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.startsWith("/api/map")) return mapResponse();
          if (url.startsWith("/api/news")) return newsResponse();
          return weatherResponse();
        }) as unknown as typeof fetch,
        now: () => NOW,
        onUpdate: vi.fn(),
      });

      await session.start();
      expect(session.getState().location).toMatchObject({
        status: "fresh",
        value: {
          coordinate: {
            latitude: LOCATION.latitude,
            longitude: LOCATION.longitude,
          },
        },
      });
      session.dispose();
      await Promise.resolve();

      expect(bridge.startCalls).toHaveLength(1);
      expect(bridge.unsubscribeCalls).toBe(0);
      expect(bridge.stopCalls).toBe(0);
    },
  );

  it("keeps prior geometry stale when a moved cell refresh fails", async () => {
    const bridge = new StreamingBridge();
    let mapCalls = 0;
    let currentTime = NOW;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/map")) {
        mapCalls += 1;
        return mapCalls === 1 ? mapResponse() : { ok: false } as Response;
      }
      if (url.startsWith("/api/news")) return newsResponse();
      return weatherResponse();
    }) as unknown as typeof fetch;
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl,
      now: () => currentTime,
      onUpdate: vi.fn(),
    });
    await session.start();
    const initialMap = session.getState().map.value;
    bridge.values.delete("relic:map-labels:v1");

    currentTime += 15_000;
    bridge.emit({
      latitude: 37.55705,
      longitude: 126.922,
      timestamp: currentTime,
    });
    await vi.waitFor(() => {
      expect(session.getState().location.value?.coordinate.latitude)
        .toBe(37.55705);
      expect(mapCalls).toBe(2);
      expect(session.getState().map.status).toBe("stale");
    });

    expect(session.getState().map.value).toEqual(initialMap);
    session.dispose();
  });
});
