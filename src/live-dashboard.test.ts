import { describe, expect, it, vi } from "vitest";
import type { AppLocation, AppLocationOptions } from "@evenrealities/even_hub_sdk";
import type { LocationBridge } from "./location";
import {
  createLiveDashboardSession,
  type LiveDashboardUpdate,
} from "./live-dashboard";
import { WEATHER_MAX_AGE_MS } from "./weather";

const NOW = Date.parse("2026-07-27T14:20:00Z");
const LOCATION: AppLocation = {
  latitude: 37.5665,
  longitude: 126.978,
  accuracy: 4,
  timestamp: NOW - 1_000,
};

function weatherResponse(temperature = 29.4): Response {
  return {
    ok: true,
    json: async () => ({
      current: {
        time: "2026-07-27T14:15",
        temperature_2m: temperature,
        apparent_temperature: 31.2,
        relative_humidity_2m: 67,
        weather_code: 2,
        wind_speed_10m: 8.2,
      },
      hourly: {
        time: ["2026-07-27T14:00", "2026-07-27T15:00"],
        precipitation_probability: [10, 20],
      },
    }),
  } as Response;
}

class TestBridge implements LocationBridge {
  readonly values = new Map<string, string>();
  readonly locationCalls: Array<AppLocationOptions | undefined> = [];

  constructor(
    private readonly getLocation: () => Promise<AppLocation | null> =
      async () => LOCATION,
  ) {}

  async getAppLocation(options?: AppLocationOptions) {
    this.locationCalls.push(options);
    return this.getLocation();
  }

  async getLocalStorage(key: string) {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

class TestDocument {
  visibilityState: DocumentVisibilityState = "visible";
  readonly added: EventListener[] = [];
  readonly removed: EventListener[] = [];

  addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
    this.added.push(listener as EventListener);
  }

  removeEventListener(
    _type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    this.removed.push(listener as EventListener);
  }

  dispatchVisibility() {
    for (const listener of this.added) listener(new Event("visibilitychange"));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("createLiveDashboardSession", () => {
  it("does no work at construction, then emits live location left and weather right", async () => {
    const bridge = new TestBridge();
    const updates: LiveDashboardUpdate[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL) =>
      weatherResponse());
    const documentTarget = new TestDocument();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
      documentTarget,
      onUpdate: (update) => updates.push(update),
    });

    expect(bridge.locationCalls).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await Promise.all([session.start(), session.start()]);

    expect(documentTarget.added).toHaveLength(1);
    expect(bridge.locationCalls).toHaveLength(1);
    expect(updates.map(({ target }) => target)).toEqual(["left", "right"]);
    expect(updates[0].state.location.value?.source).toBe("live");
    expect(updates[1].state.weather).toMatchObject({
      status: "fresh",
      value: { temperature: 29.4, condition: "대체로 맑음" },
      fetchedAt: NOW,
    });
  });

  it("emits a fresh cached weather snapshot only once", async () => {
    const bridge = new TestBridge();
    bridge.values.set("relic:weather:v1", JSON.stringify({
      value: {
        temperature: 24,
        apparentTemperature: 25,
        humidity: 50,
        windSpeed: 3,
        precipitationProbability: 0,
        weatherCode: 0,
        condition: "맑음",
      },
      fetchedAt: NOW - 1_000,
      coordinate: {
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
      },
    }));
    const updates: LiveDashboardUpdate[] = [];
    const fetchImpl = vi.fn();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });

    await session.start();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates.map(({ target }) => target)).toEqual(["left", "right"]);
    expect(updates[1].state.weather.value?.temperature).toBe(24);
  });

  it("does not emit the same stale cache again after a failed refresh", async () => {
    const bridge = new TestBridge();
    bridge.values.set("relic:weather:v1", JSON.stringify({
      value: {
        temperature: 24,
        apparentTemperature: 25,
        humidity: 50,
        windSpeed: 3,
        precipitationProbability: 0,
        weatherCode: 0,
        condition: "맑음",
      },
      fetchedAt: NOW - WEATHER_MAX_AGE_MS - 1,
      coordinate: {
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
      },
    }));
    const updates: LiveDashboardUpdate[] = [];
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: vi.fn(async () => ({ ok: false } as Response)) as unknown as
        typeof fetch,
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });

    await session.start();

    expect(updates.map(({ target }) => target)).toEqual(["left", "right"]);
    expect(updates[1].state.weather.status).toBe("stale");
  });

  it("emits stale cache followed by different fresh network weather", async () => {
    const bridge = new TestBridge();
    bridge.values.set("relic:weather:v1", JSON.stringify({
      value: {
        temperature: 24,
        apparentTemperature: 25,
        humidity: 50,
        windSpeed: 3,
        precipitationProbability: 0,
        weatherCode: 0,
        condition: "맑음",
      },
      fetchedAt: NOW - WEATHER_MAX_AGE_MS - 1,
      coordinate: {
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
      },
    }));
    const updates: LiveDashboardUpdate[] = [];
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: vi.fn(async () => weatherResponse()) as unknown as typeof fetch,
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });

    await session.start();

    expect(updates.map(({ target }) => target)).toEqual([
      "left",
      "right",
      "right",
    ]);
    expect(updates.slice(1).map(({ state }) => state.weather.status)).toEqual([
      "stale",
      "fresh",
    ]);
    expect(updates.at(-1)?.state.weather.value?.temperature).toBe(29.4);
  });

  it("does not let visibility refresh demo weather before location resolves", async () => {
    const location = deferred<AppLocation | null>();
    const documentTarget = new TestDocument();
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL) =>
      weatherResponse());
    const session = createLiveDashboardSession({
      bridge: new TestBridge(() => location.promise),
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
      documentTarget,
      onUpdate: vi.fn(),
    });

    const starting = session.start();
    documentTarget.dispatchVisibility();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchImpl).not.toHaveBeenCalled();

    location.resolve(LOCATION);
    await starting;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      `latitude=${LOCATION.latitude}`,
    );
  });

  it("refreshes stale visible weather and coalesces concurrent visibility events", async () => {
    let now = NOW;
    const secondFetch = deferred<Response>();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(weatherResponse())
      .mockReturnValueOnce(secondFetch.promise);
    const documentTarget = new TestDocument();
    const updates: LiveDashboardUpdate[] = [];
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl: fetchImpl as typeof fetch,
      now: () => now,
      documentTarget,
      onUpdate: (update) => updates.push(update),
    });
    await session.start();

    documentTarget.visibilityState = "hidden";
    now += WEATHER_MAX_AGE_MS + 1;
    documentTarget.dispatchVisibility();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    documentTarget.visibilityState = "visible";
    documentTarget.dispatchVisibility();
    documentTarget.dispatchVisibility();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    secondFetch.resolve(weatherResponse(30.4));
    await vi.waitFor(() => {
      expect(updates.at(-1)?.state.weather.value?.temperature).toBe(30.4);
    });
  });

  it("disposes once and blocks late state, emissions, refresh, and restart", async () => {
    const location = deferred<AppLocation | null>();
    const bridge = new TestBridge(() => location.promise);
    const documentTarget = new TestDocument();
    const onUpdate = vi.fn();
    const fetchImpl = vi.fn();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: fetchImpl as typeof fetch,
      documentTarget,
      onUpdate,
    });

    const starting = session.start();
    session.dispose();
    session.dispose();
    location.resolve(LOCATION);
    await starting;
    documentTarget.dispatchVisibility();
    await session.start();

    expect(documentTarget.added).toHaveLength(1);
    expect(documentTarget.removed).toEqual(documentTarget.added);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(session.getState().location.value?.source).toBe("demo");
  });

  it("returns defensive snapshots from getState and update callbacks", async () => {
    const updates: LiveDashboardUpdate[] = [];
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl: vi.fn(async () => weatherResponse()) as unknown as typeof fetch,
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });
    await session.start();

    const exposed = session.getState() as {
      location: { value?: { coordinate: { latitude: number } } };
      news: { value?: string[] };
    };
    exposed.location.value!.coordinate.latitude = 0;
    exposed.news.value!.push("mutated");
    const callbackState = updates[0].state as {
      location: { value?: { coordinate: { longitude: number } } };
    };
    callbackState.location.value!.coordinate.longitude = 0;

    expect(session.getState().location.value?.coordinate).toEqual({
      latitude: LOCATION.latitude,
      longitude: LOCATION.longitude,
    });
    expect(session.getState().news.value).toEqual([]);
  });
});
