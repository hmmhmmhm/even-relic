// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type {
  AppLocation,
  AppLocationOptions,
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

function mapResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: [{
        kind: "major",
        points: [[37.55, 126.91], [37.56, 126.92]],
      }],
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
        cell: "37.555,126.920",
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

    expect(session.getState().map.status).toBe("unavailable");
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
});
