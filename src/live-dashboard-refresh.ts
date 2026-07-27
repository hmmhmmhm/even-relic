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

export type LiveRefreshTarget = "left" | "right" | "all";

type LiveDashboardRefreshOptions = {
  readonly bridge: LocationBridge;
  readonly fetchImpl: typeof fetch;
  readonly now: () => number;
  readonly getState: () => LiveDashboardState;
  readonly setState: (state: LiveDashboardState) => void;
  readonly emit: (target: LiveRefreshTarget) => void;
  readonly isDisposed: () => boolean;
};

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
        && item.url === other.url
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

  const refreshWeather = (): Promise<void> => {
    if (options.isDisposed()) return Promise.resolve();
    if (weatherPromise) return weatherPromise;
    weatherPromise = (async () => {
      const coordinate = options.getState().location.value?.coordinate;
      if (!coordinate || options.isDisposed()) return;
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
          },
        );
      } catch {
        result = { status: "unavailable" };
      }
      if (
        options.isDisposed()
        || isSameWeatherState(cachedWeather, result)
      ) {
        return;
      }
      setWeather(result);
      options.emit("right");
    })().finally(() => {
      weatherPromise = undefined;
    });
    return weatherPromise;
  };

  const refreshNews = (): Promise<void> => {
    if (options.isDisposed()) return Promise.resolve();
    if (newsPromise) return newsPromise;
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
          },
        );
      } catch {
        result = { status: "unavailable" };
      }
      if (options.isDisposed() || isSameNewsState(cachedNews, result)) return;
      setNews(result);
      options.emit("right");
    })().finally(() => {
      newsPromise = undefined;
    });
    return newsPromise;
  };

  const refreshMap = (): Promise<void> => {
    if (options.isDisposed()) return Promise.resolve();
    if (mapPromise) return mapPromise;
    mapPromise = (async () => {
      const coordinate = options.getState().location.value?.coordinate;
      if (!coordinate || options.isDisposed()) return;
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
          },
        );
      } catch {
        result = { status: "unavailable" };
      }
      if (result.status === "unavailable" && previousMap.value) {
        result = {
          status: "stale",
          value: previousMap.value,
          fetchedAt: previousMap.fetchedAt,
        };
      }
      if (options.isDisposed() || isSameMapState(cachedMap, result)) return;
      setMap(result);
      options.emit("left");
    })().finally(() => {
      mapPromise = undefined;
    });
    return mapPromise;
  };

  return { refreshWeather, refreshNews, refreshMap };
}
