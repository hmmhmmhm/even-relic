import { readCache, writeCache, type EvenStorage } from "./live-cache";
import type { Coordinate, DataState, WeatherValue } from "./live-state";

export const WEATHER_MAX_AGE_MS = 15 * 60 * 1_000;
export const WEATHER_CACHE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1_000;

const WEATHER_REQUEST_TIMEOUT_MS = 8_000;
const WEATHER_CURRENT_FIELDS =
  "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m";

type WeatherCache = {
  readonly value: WeatherValue;
  readonly fetchedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPercentage(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function isWeatherValue(value: unknown): value is WeatherValue {
  return (
    isRecord(value) &&
    isFiniteNumber(value.temperature) &&
    isFiniteNumber(value.apparentTemperature) &&
    isPercentage(value.humidity) &&
    isFiniteNumber(value.windSpeed) &&
    value.windSpeed >= 0 &&
    isPercentage(value.precipitationProbability) &&
    isFiniteNumber(value.weatherCode) &&
    typeof value.condition === "string" &&
    value.condition === weatherCodeLabel(value.weatherCode)
  );
}

function isWeatherCache(value: unknown): value is WeatherCache {
  return (
    isRecord(value) &&
    isWeatherValue(value.value) &&
    isFiniteNumber(value.fetchedAt)
  );
}

function requiredFinite(
  value: unknown,
  field: string,
): number {
  if (!isFiniteNumber(value)) {
    throw new Error(`Invalid weather field: ${field}`);
  }
  return value;
}

function requiredPercentage(
  value: unknown,
  field: string,
): number {
  if (!isPercentage(value)) {
    throw new Error(`Invalid weather percentage: ${field}`);
  }
  return value;
}

export function weatherCodeLabel(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 99) {
    return "알 수 없음";
  }
  if (code === 0) {
    return "맑음";
  }
  if (code <= 2) {
    return "대체로 맑음";
  }
  if (code === 3) {
    return "흐림";
  }
  if (code <= 48) {
    return "안개";
  }
  if (code <= 57) {
    return "이슬비";
  }
  if (code <= 67) {
    return "비";
  }
  if (code <= 77) {
    return "눈";
  }
  if (code <= 82) {
    return "소나기";
  }
  if (code <= 86) {
    return "눈 소나기";
  }
  return "뇌우";
}

export function buildWeatherUrl(coordinate: Coordinate): URL {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coordinate.latitude));
  url.searchParams.set("longitude", String(coordinate.longitude));
  url.searchParams.set("current", WEATHER_CURRENT_FIELDS);
  url.searchParams.set("hourly", "precipitation_probability");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");
  return url;
}

export function parseWeatherResponse(input: unknown): WeatherValue {
  if (!isRecord(input) || !isRecord(input.current) || !isRecord(input.hourly)) {
    throw new Error("Invalid weather response");
  }

  const current = input.current;
  const hourly = input.hourly;
  if (typeof current.time !== "string" || current.time.length === 0) {
    throw new Error("Invalid current weather time");
  }
  const currentTime = current.time;
  if (
    !Array.isArray(hourly.time) ||
    !Array.isArray(hourly.precipitation_probability) ||
    hourly.time.length === 0 ||
    hourly.time.length !== hourly.precipitation_probability.length ||
    !hourly.time.every(
      (time): time is string => typeof time === "string" && time.length > 0,
    )
  ) {
    throw new Error("Invalid hourly weather response");
  }

  const probabilities = hourly.precipitation_probability.map(
    (value, index) =>
      requiredPercentage(value, `precipitation_probability[${index}]`),
  );
  const selectedIndex = hourly.time.findIndex(
    (time) => time >= currentTime,
  );
  const precipitationProbability =
    probabilities[selectedIndex >= 0 ? selectedIndex : probabilities.length - 1];
  const windSpeed = requiredFinite(current.wind_speed_10m, "wind_speed_10m");
  if (windSpeed < 0) {
    throw new Error("Invalid weather field: wind_speed_10m");
  }

  const weatherCode = requiredFinite(current.weather_code, "weather_code");
  return {
    temperature: requiredFinite(current.temperature_2m, "temperature_2m"),
    apparentTemperature: requiredFinite(
      current.apparent_temperature,
      "apparent_temperature",
    ),
    humidity: requiredPercentage(
      current.relative_humidity_2m,
      "relative_humidity_2m",
    ),
    windSpeed,
    precipitationProbability,
    weatherCode,
    condition: weatherCodeLabel(weatherCode),
  };
}

function unavailableWeather(): DataState<WeatherValue> {
  return { status: "unavailable" };
}

export async function resolveWeather(
  storage: EvenStorage,
  coordinate: Coordinate,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
  onCached?: (cached: DataState<WeatherValue>) => void,
): Promise<DataState<WeatherValue>> {
  const cache = await readCache(storage, "weather", isWeatherCache);
  let staleState: DataState<WeatherValue> | undefined;

  if (cache && cache.fetchedAt <= now) {
    const age = now - cache.fetchedAt;
    if (age <= WEATHER_CACHE_MAX_STALE_MS) {
      const cachedState: DataState<WeatherValue> = {
        status: age <= WEATHER_MAX_AGE_MS ? "fresh" : "stale",
        value: { ...cache.value },
        fetchedAt: cache.fetchedAt,
      };
      try {
        onCached?.({
          ...cachedState,
          value: cachedState.value ? { ...cachedState.value } : undefined,
        });
      } catch {
        // Rendering an accepted cache is optional and must not block refresh.
      }
      if (cachedState.status === "fresh") {
        return cachedState;
      }
      staleState = cachedState;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WEATHER_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(buildWeatherUrl(coordinate), {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("Open-Meteo request failed");
    }

    const value = parseWeatherResponse(await response.json());
    const freshState: DataState<WeatherValue> = {
      status: "fresh",
      value,
      fetchedAt: now,
    };
    await writeCache<WeatherCache>(storage, "weather", {
      value,
      fetchedAt: now,
    });
    return freshState;
  } catch {
    return staleState ?? unavailableWeather();
  } finally {
    clearTimeout(timeout);
  }
}
