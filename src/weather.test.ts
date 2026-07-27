import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "./live-cache";
import type { WeatherValue } from "./live-state";
import {
  WEATHER_CACHE_MAX_STALE_MS,
  WEATHER_MAX_AGE_MS,
  buildWeatherUrl,
  parseWeatherResponse,
  resolveWeather,
  weatherCodeLabel,
} from "./weather";

const NOW = Date.parse("2026-07-27T14:20:00Z");

const WEATHER: WeatherValue = {
  temperature: 28.4,
  apparentTemperature: 30.1,
  humidity: 72,
  windSpeed: 8.5,
  precipitationProbability: 20,
  weatherCode: 2,
  condition: "대체로 맑음",
};

function responseFixture(): Record<string, unknown> {
  return {
    current: {
      time: "2026-07-27T14:15",
      temperature_2m: 28.4,
      apparent_temperature: 30.1,
      relative_humidity_2m: 72,
      weather_code: 2,
      wind_speed_10m: 8.5,
    },
    hourly: {
      time: ["2026-07-27T14:00", "2026-07-27T15:00"],
      precipitation_probability: [10, 20],
    },
  };
}

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  readonly reads: string[] = [];
  readonly writes: Array<[string, string]> = [];

  constructor(
    private readonly mode: "working" | "read-fails" | "write-fails" =
      "working",
  ) {}

  async getLocalStorage(key: string): Promise<string> {
    this.reads.push(key);
    if (this.mode === "read-fails") {
      throw new Error("read failed");
    }
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    if (this.mode === "write-fails") {
      throw new Error("write failed");
    }
    this.values.set(key, value);
    return true;
  }
}

function setCache(
  storage: TestStorage,
  cache: { value: WeatherValue; fetchedAt: number } | unknown,
): void {
  storage.values.set("relic:weather:v1", JSON.stringify(cache));
}

function jsonFetch(
  payload: unknown,
  options: { ok?: boolean; jsonRejects?: boolean } = {},
): typeof fetch {
  return vi.fn(async () => ({
    ok: options.ok ?? true,
    json: options.jsonRejects
      ? async () => {
          throw new Error("invalid JSON");
        }
      : async () => payload,
  })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("weatherCodeLabel", () => {
  it.each([
    [0, "맑음"],
    [1, "대체로 맑음"],
    [2, "대체로 맑음"],
    [3, "흐림"],
    [4, "안개"],
    [48, "안개"],
    [49, "이슬비"],
    [57, "이슬비"],
    [58, "비"],
    [67, "비"],
    [68, "눈"],
    [77, "눈"],
    [78, "소나기"],
    [82, "소나기"],
    [83, "눈 소나기"],
    [86, "눈 소나기"],
    [87, "뇌우"],
    [99, "뇌우"],
  ])("maps WMO code %s to %s", (code, label) => {
    expect(weatherCodeLabel(code)).toBe(label);
  });

  it.each([-1, 0.5, 100, Number.NaN, Number.POSITIVE_INFINITY])(
    "safely labels invalid or unknown code %s",
    (code) => {
      expect(weatherCodeLabel(code)).toBe("알 수 없음");
    },
  );
});

describe("buildWeatherUrl", () => {
  it("builds the exact keyless Open-Meteo request", () => {
    const url = buildWeatherUrl({
      latitude: 37.5563,
      longitude: 126.922,
    });

    expect(url.origin + url.pathname).toBe(
      "https://api.open-meteo.com/v1/forecast",
    );
    expect(url.searchParams.get("latitude")).toBe("37.5563");
    expect(url.searchParams.get("longitude")).toBe("126.922");
    expect(url.searchParams.get("current")).toBe(
      "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    );
    expect(url.searchParams.get("hourly")).toBe(
      "precipitation_probability",
    );
    expect(url.searchParams.get("forecast_days")).toBe("1");
    expect(url.searchParams.get("timezone")).toBe("auto");
  });
});

describe("parseWeatherResponse", () => {
  it("normalizes current weather and selects the first hourly slot at or after current time", () => {
    expect(parseWeatherResponse(responseFixture())).toEqual(WEATHER);
  });

  it("uses the final hourly probability when current time is after the forecast slots", () => {
    const input = responseFixture();
    input.current = {
      ...(input.current as Record<string, unknown>),
      time: "2026-07-27T16:00",
    };

    expect(parseWeatherResponse(input).precipitationProbability).toBe(20);
  });

  it.each([
    null,
    [],
    {},
    { current: {}, hourly: {} },
    {
      ...responseFixture(),
      current: {
        ...(responseFixture().current as Record<string, unknown>),
        temperature_2m: Number.NaN,
      },
    },
    {
      ...responseFixture(),
      current: {
        ...(responseFixture().current as Record<string, unknown>),
        relative_humidity_2m: 101,
      },
    },
    {
      ...responseFixture(),
      hourly: {
        time: ["2026-07-27T14:00"],
        precipitation_probability: [10, 20],
      },
    },
    {
      ...responseFixture(),
      hourly: {
        time: [],
        precipitation_probability: [],
      },
    },
    {
      ...responseFixture(),
      hourly: {
        time: ["2026-07-27T14:00"],
        precipitation_probability: [-1],
      },
    },
  ])("rejects malformed weather payload %#", (input) => {
    expect(() => parseWeatherResponse(input)).toThrow();
  });
});

describe("resolveWeather", () => {
  it("returns a fresh cache at the age boundary without fetching", async () => {
    const storage = new TestStorage();
    setCache(storage, {
      value: WEATHER,
      fetchedAt: NOW - WEATHER_MAX_AGE_MS,
    });
    const fetchImpl = jsonFetch(responseFixture());
    const cachedStates: unknown[] = [];

    await expect(
      resolveWeather(storage, { latitude: 37.5, longitude: 127 }, fetchImpl, NOW,
        (cached) => cachedStates.push(cached)),
    ).resolves.toEqual({
      status: "fresh",
      value: WEATHER,
      fetchedAt: NOW - WEATHER_MAX_AGE_MS,
    });
    expect(cachedStates).toEqual([
      {
        status: "fresh",
        value: WEATHER,
        fetchedAt: NOW - WEATHER_MAX_AGE_MS,
      },
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("emits stale cache before fetching and replaces it with fresh weather", async () => {
    const storage = new TestStorage();
    setCache(storage, {
      value: { ...WEATHER, temperature: 25 },
      fetchedAt: NOW - WEATHER_MAX_AGE_MS - 1,
    });
    const events: string[] = [];
    const fetchImpl = vi.fn(async () => {
      events.push("fetch");
      return { ok: true, json: async () => responseFixture() } as Response;
    }) as unknown as typeof fetch;

    const result = await resolveWeather(
      storage,
      { latitude: 37.5, longitude: 127 },
      fetchImpl,
      NOW,
      (cached) => {
        events.push(`cache:${cached.status}`);
      },
    );

    expect(events).toEqual(["cache:stale", "fetch"]);
    expect(result).toEqual({
      status: "fresh",
      value: WEATHER,
      fetchedAt: NOW,
    });
  });

  it.each([
    ["HTTP", jsonFetch({}, { ok: false })],
    ["JSON", jsonFetch({}, { jsonRejects: true })],
    ["payload", jsonFetch({ malformed: true })],
    [
      "network",
      vi.fn(async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    ],
  ])("returns accepted stale cache after a %s refresh failure", async (_name, fetchImpl) => {
    const storage = new TestStorage();
    const stale = {
      value: { ...WEATHER, temperature: 24 },
      fetchedAt: NOW - WEATHER_MAX_AGE_MS - 1,
    };
    setCache(storage, stale);

    await expect(
      resolveWeather(
        storage,
        { latitude: 37.5, longitude: 127 },
        fetchImpl,
        NOW,
      ),
    ).resolves.toEqual({ status: "stale", ...stale });
  });

  it("returns unavailable when no cache exists and the network fails", async () => {
    const storage = new TestStorage();
    const fetchImpl = jsonFetch({}, { ok: false });

    await expect(
      resolveWeather(
        storage,
        { latitude: 37.5, longitude: 127 },
        fetchImpl,
        NOW,
      ),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it.each([
    ["corrupt", "{not-json"],
    [
      "future",
      JSON.stringify({ value: WEATHER, fetchedAt: NOW + 1 }),
    ],
    [
      "expired",
      JSON.stringify({
        value: WEATHER,
        fetchedAt: NOW - WEATHER_CACHE_MAX_STALE_MS - 1,
      }),
    ],
    [
      "malformed value",
      JSON.stringify({
        value: { ...WEATHER, humidity: -1 },
        fetchedAt: NOW - WEATHER_MAX_AGE_MS - 1,
      }),
    ],
  ])("ignores %s cache data", async (_name, raw) => {
    const storage = new TestStorage();
    storage.values.set("relic:weather:v1", raw);
    const cachedStates: unknown[] = [];

    await expect(
      resolveWeather(
        storage,
        { latitude: 37.5, longitude: 127 },
        jsonFetch({}, { ok: false }),
        NOW,
        (cached) => cachedStates.push(cached),
      ),
    ).resolves.toEqual({ status: "unavailable" });
    expect(cachedStates).toEqual([]);
  });

  it("persists successful weather using the versioned cache schema", async () => {
    const storage = new TestStorage();

    await resolveWeather(
      storage,
      { latitude: 37.5, longitude: 127 },
      jsonFetch(responseFixture()),
      NOW,
    );

    expect(storage.writes).toEqual([
      [
        "relic:weather:v1",
        JSON.stringify({ value: WEATHER, fetchedAt: NOW }),
      ],
    ]);
  });

  it("does not throw when storage reading or writing fails", async () => {
    const readFailure = new TestStorage("read-fails");
    const writeFailure = new TestStorage("write-fails");

    await expect(
      resolveWeather(
        readFailure,
        { latitude: 37.5, longitude: 127 },
        jsonFetch({}, { ok: false }),
        NOW,
      ),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      resolveWeather(
        writeFailure,
        { latitude: 37.5, longitude: 127 },
        jsonFetch(responseFixture()),
        NOW,
      ),
    ).resolves.toEqual({
      status: "fresh",
      value: WEATHER,
      fetchedAt: NOW,
    });
  });

  it("aborts a request after eight seconds and clears its timer", async () => {
    vi.useFakeTimers();
    const storage = new TestStorage();
    let requestSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal ?? undefined;
          requestSignal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;

    const pending = resolveWeather(
      storage,
      { latitude: 37.5, longitude: 127 },
      fetchImpl,
      NOW,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(requestSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(8_000);

    await expect(pending).resolves.toEqual({ status: "unavailable" });
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
