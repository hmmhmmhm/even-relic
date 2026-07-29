import type {
  DataState,
  LiveDashboardState,
  MapValue,
  NewsItem,
  WeatherValue,
} from "./live-state";
import { resolveMap } from "./map";
import { resolveNews } from "./news";
import type { LocationBridge } from "./location";
import { resolveWeather } from "./weather";
import { logDiagnostic } from "./diagnostic-log";
import type { PhoneLocale } from "./phone-types";

export type LiveRefreshTarget = "left" | "right" | "all";
export type LiveRefreshDecision = "accepted" | "dropped";

type LiveDashboardRefreshOptions = {
  readonly bridge: LocationBridge;
  readonly fetchImpl: typeof fetch;
  readonly now: () => number;
  readonly getState: () => LiveDashboardState;
  readonly setState: (state: LiveDashboardState) => void;
  readonly emit: (target: LiveRefreshTarget) => void;
  readonly isDisposed: () => boolean;
  readonly getLocale?: () => PhoneLocale;
};

const diagnosticNow = () => (
  typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now()
);

const diagnosticDuration = (startedAt: number) => (
  diagnosticNow() - startedAt
);

const diagnosticErrorKind = (error: unknown) => (
  error instanceof Error ? error.name : typeof error
);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isSameWeatherState(
  left: DataState<WeatherValue> | undefined,
  right: DataState<WeatherValue>,
): boolean {
  if (
    !left
    || left.status !== right.status
    || left.fetchedAt !== right.fetchedAt
  ) {
    return false;
  }
  if (!left.value || !right.value) return left.value === right.value;
  return left.value.temperature === right.value.temperature
    && left.value.apparentTemperature === right.value.apparentTemperature
    && left.value.humidity === right.value.humidity
    && left.value.windSpeed === right.value.windSpeed
    && left.value.precipitationProbability
      === right.value.precipitationProbability
    && left.value.weatherCode === right.value.weatherCode
    && left.value.condition === right.value.condition;
}

function isSameNewsState(
  left: DataState<readonly NewsItem[]> | undefined,
  right: DataState<readonly NewsItem[]>,
): boolean {
  if (
    !left
    || left.status !== right.status
    || left.fetchedAt !== right.fetchedAt
  ) {
    return false;
  }
  if (!left.value || !right.value) return left.value === right.value;
  return left.value.length === right.value.length
    && left.value.every((item, index) => {
      const other = right.value?.[index];
      return item.id === other?.id
        && item.title === other.title
        && item.source === other.source
        && item.url === other.url
        && item.summary === other.summary
        && item.publishedAt === other.publishedAt;
    });
}

function isSameMapState(
  left: DataState<MapValue> | undefined,
  right: DataState<MapValue>,
): boolean {
  return Boolean(
    left
    && left.status === right.status
    && left.fetchedAt === right.fetchedAt
    && left.value?.cell === right.value?.cell,
  );
}

export function createLiveDashboardRefresh(
  options: LiveDashboardRefreshOptions,
) {
  let weatherPromise: Promise<void> | undefined;
  let newsPromise: Promise<void> | undefined;
  let mapPromise: Promise<void> | undefined;

  const setWeather = (weather: DataState<WeatherValue>) => {
    options.setState({ ...options.getState(), weather: clone(weather) });
  };
  const setNews = (news: DataState<readonly NewsItem[]>) => {
    options.setState({ ...options.getState(), news: clone(news) });
  };
  const setMap = (map: DataState<MapValue>) => {
    options.setState({ ...options.getState(), map: clone(map) });
  };

  const refreshWeather = (
    force = false,
  ): Promise<LiveRefreshDecision> => {
    if (options.isDisposed()) {
      logDiagnostic("LIVE", "weather skipped · disposed");
      return Promise.resolve("dropped");
    }
    if (weatherPromise) {
      logDiagnostic("LIVE", "weather dropped · busy");
      return Promise.resolve("dropped");
    }
    const startedAt = diagnosticNow();
    logDiagnostic("LIVE", "weather start");
    weatherPromise = (async () => {
      const coordinate = options.getState().location.value?.coordinate;
      if (!coordinate || options.isDisposed()) {
        logDiagnostic(
          "LIVE",
          `weather skipped · ${coordinate ? "disposed" : "no location"}`,
        );
        return;
      }
      let cachedWeather: DataState<WeatherValue> | undefined;
      let result: DataState<WeatherValue>;
      try {
        result = await resolveWeather(
          options.bridge,
          coordinate,
          options.fetchImpl,
          options.now(),
          (cached) => {
            if (options.isDisposed()) return;
            cachedWeather = cached;
            setWeather(cached);
            options.emit("right");
            logDiagnostic(
              "LIVE",
              `weather cache emitted · right · ${cached.status}`,
            );
          },
          force,
        );
      } catch (error) {
        logDiagnostic(
          "ERROR",
          `weather refresh failed · ${diagnosticErrorKind(error)}`,
        );
        result = { status: "unavailable" };
      }
      logDiagnostic("LIVE", `weather resolved · ${result.status}`);
      if (
        options.isDisposed()
        || isSameWeatherState(cachedWeather, result)
      ) {
        return;
      }
      setWeather(result);
      options.emit("right");
      logDiagnostic("LIVE", `weather emitted · right · ${result.status}`);
    })().finally(() => {
      logDiagnostic(
        "LIVE",
        "weather complete",
        diagnosticDuration(startedAt),
      );
      weatherPromise = undefined;
    });
    return weatherPromise.then(() => "accepted");
  };

  const refreshNews = (
    force = false,
  ): Promise<LiveRefreshDecision> => {
    if (options.isDisposed()) {
      logDiagnostic("LIVE", "news skipped · disposed");
      return Promise.resolve("dropped");
    }
    if (newsPromise) {
      logDiagnostic("LIVE", "news dropped · busy");
      return Promise.resolve("dropped");
    }
    const startedAt = diagnosticNow();
    logDiagnostic("LIVE", "news start");
    newsPromise = (async () => {
      let cachedNews: DataState<readonly NewsItem[]> | undefined;
      let result: DataState<readonly NewsItem[]>;
      try {
        result = await resolveNews(
          options.bridge,
          options.fetchImpl,
          options.now(),
          (cached) => {
            if (options.isDisposed()) return;
            cachedNews = cached;
            setNews(cached);
            options.emit("right");
            logDiagnostic(
              "LIVE",
              `news cache emitted · right · ${cached.status}`,
            );
          },
          force,
          options.getLocale?.() ?? "ko",
        );
      } catch (error) {
        logDiagnostic(
          "ERROR",
          `news refresh failed · ${diagnosticErrorKind(error)}`,
        );
        result = { status: "unavailable" };
      }
      logDiagnostic("LIVE", `news resolved · ${result.status}`);
      if (options.isDisposed() || isSameNewsState(cachedNews, result)) return;
      setNews(result);
      options.emit("right");
      logDiagnostic("LIVE", `news emitted · right · ${result.status}`);
    })().finally(() => {
      logDiagnostic("LIVE", "news complete", diagnosticDuration(startedAt));
      newsPromise = undefined;
    });
    return newsPromise.then(() => "accepted");
  };

  const refreshMap = (): Promise<void> => {
    if (options.isDisposed()) {
      logDiagnostic("LIVE", "map skipped · disposed");
      return Promise.resolve();
    }
    if (mapPromise) {
      logDiagnostic("LIVE", "map dropped · busy");
      return Promise.resolve();
    }
    const startedAt = diagnosticNow();
    logDiagnostic("LIVE", "map start");
    mapPromise = (async () => {
      const coordinate = options.getState().location.value?.coordinate;
      if (!coordinate || options.isDisposed()) {
        logDiagnostic(
          "LIVE",
          `map skipped · ${coordinate ? "disposed" : "no location"}`,
        );
        return;
      }
      const previousMap = options.getState().map;
      let cachedMap: DataState<MapValue> | undefined;
      let result: DataState<MapValue>;
      try {
        result = await resolveMap(
          options.bridge,
          coordinate,
          options.fetchImpl,
          options.now(),
          (cached) => {
            if (options.isDisposed()) return;
            cachedMap = cached;
            setMap(cached);
            options.emit("left");
            logDiagnostic(
              "LIVE",
              `map cache emitted · left · ${cached.status}`,
            );
          },
        );
      } catch (error) {
        logDiagnostic(
          "ERROR",
          `map refresh failed · ${diagnosticErrorKind(error)}`,
        );
        result = { status: "unavailable" };
      }
      if (result.status === "unavailable" && previousMap.value) {
        result = {
          status: "stale",
          value: previousMap.value,
          fetchedAt: previousMap.fetchedAt,
        };
      }
      logDiagnostic("LIVE", `map resolved · ${result.status}`);
      if (options.isDisposed() || isSameMapState(cachedMap, result)) return;
      setMap(result);
      options.emit("left");
      logDiagnostic("LIVE", `map emitted · left · ${result.status}`);
    })().finally(() => {
      logDiagnostic("LIVE", "map complete", diagnosticDuration(startedAt));
      mapPromise = undefined;
    });
    return mapPromise;
  };

  return { refreshWeather, refreshNews, refreshMap };
}
