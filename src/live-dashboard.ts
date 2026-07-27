import {
  createInitialLiveDashboardState,
  type DataState,
  type LiveDashboardState,
  type MapValue,
  type NewsItem,
  type WeatherValue,
} from "./live-state";
import {
  resolveInitialLocation,
  type LocationBridge,
} from "./location";
import { MAP_MAX_AGE_MS, resolveMap } from "./map";
import { NEWS_MAX_AGE_MS, resolveNews } from "./news";
import { resolveWeather, WEATHER_MAX_AGE_MS } from "./weather";

export type LiveDashboardUpdate = {
  readonly state: LiveDashboardState;
  readonly target: "left" | "right" | "all";
};

type DocumentTarget = Pick<
  Document,
  "addEventListener" | "removeEventListener" | "visibilityState"
>;

type LiveDashboardSessionOptions = {
  readonly bridge: LocationBridge;
  readonly onUpdate: (update: LiveDashboardUpdate) => void;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly documentTarget?: DocumentTarget;
};

function cloneState(state: LiveDashboardState): LiveDashboardState {
  return JSON.parse(JSON.stringify(state)) as LiveDashboardState;
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

export function createLiveDashboardSession(
  options: LiveDashboardSessionOptions,
): {
  start(): Promise<void>;
  getState(): LiveDashboardState;
  dispose(): void;
} {
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;
  const documentTarget = options.documentTarget
    ?? (typeof document === "undefined" ? undefined : document);
  let state = createInitialLiveDashboardState();
  let disposed = false;
  let listenerRegistered = false;
  let locationResolved = false;
  let startPromise: Promise<void> | undefined;
  let weatherPromise: Promise<void> | undefined;
  let newsPromise: Promise<void> | undefined;
  let mapPromise: Promise<void> | undefined;

  const emit = (target: LiveDashboardUpdate["target"]) => {
    if (disposed) return;
    try {
      options.onUpdate({ state: cloneState(state), target });
    } catch {
      // A preview/render callback must not stop the live-data session.
    }
  };

  const setWeather = (weather: DataState<WeatherValue>) => {
    state = { ...state, weather: cloneState({
      ...state,
      weather,
    }).weather };
  };
  const setNews = (news: DataState<readonly NewsItem[]>) => {
    state = { ...state, news: cloneState({
      ...state,
      news,
    }).news };
  };
  const setMap = (map: DataState<MapValue>) => {
    state = { ...state, map: cloneState({
      ...state,
      map,
    }).map };
  };

  const refreshWeather = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (weatherPromise) return weatherPromise;

    weatherPromise = (async () => {
      const coordinate = state.location.value?.coordinate;
      if (!coordinate || disposed) return;
      let cachedWeather: DataState<WeatherValue> | undefined;
      let result: DataState<WeatherValue>;
      try {
        result = await resolveWeather(
          options.bridge,
          coordinate,
          fetchImpl,
          now(),
          (cached) => {
            if (disposed) return;
            cachedWeather = cached;
            setWeather(cached);
            emit("right");
          },
        );
      } catch {
        result = { status: "unavailable" };
      }
      if (disposed || isSameWeatherState(cachedWeather, result)) return;
      setWeather(result);
      emit("right");
    })().finally(() => {
      weatherPromise = undefined;
    });
    return weatherPromise;
  };

  const refreshNews = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (newsPromise) return newsPromise;

    newsPromise = (async () => {
      let cachedNews: DataState<readonly NewsItem[]> | undefined;
      let result: DataState<readonly NewsItem[]>;
      try {
        result = await resolveNews(
          options.bridge,
          fetchImpl,
          now(),
          (cached) => {
            if (disposed) return;
            cachedNews = cached;
            setNews(cached);
            emit("right");
          },
        );
      } catch {
        result = { status: "unavailable" };
      }
      if (disposed || isSameNewsState(cachedNews, result)) return;
      setNews(result);
      emit("right");
    })().finally(() => {
      newsPromise = undefined;
    });
    return newsPromise;
  };

  const refreshMap = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (mapPromise) return mapPromise;

    mapPromise = (async () => {
      const coordinate = state.location.value?.coordinate;
      if (!coordinate || disposed) return;
      let cachedMap: DataState<MapValue> | undefined;
      let result: DataState<MapValue>;
      try {
        result = await resolveMap(
          options.bridge,
          coordinate,
          fetchImpl,
          now(),
          (cached) => {
            if (disposed) return;
            cachedMap = cached;
            setMap(cached);
            emit("left");
          },
        );
      } catch {
        result = { status: "unavailable" };
      }
      if (disposed || isSameMapState(cachedMap, result)) return;
      setMap(result);
      emit("left");
    })().finally(() => {
      mapPromise = undefined;
    });
    return mapPromise;
  };

  const onVisibilityChange = () => {
    if (
      disposed
      || !locationResolved
      || documentTarget?.visibilityState !== "visible"
    ) {
      return;
    }
    const currentTime = now();
    const weatherFetchedAt = state.weather.fetchedAt;
    if (
      weatherFetchedAt === undefined
      || currentTime - weatherFetchedAt >= WEATHER_MAX_AGE_MS
    ) {
      void refreshWeather();
    }
    const newsFetchedAt = state.news.fetchedAt;
    if (
      newsFetchedAt === undefined
      || currentTime - newsFetchedAt >= NEWS_MAX_AGE_MS
    ) {
      void refreshNews();
    }
    const mapFetchedAt = state.map.fetchedAt;
    if (
      mapFetchedAt === undefined
      || currentTime - mapFetchedAt >= MAP_MAX_AGE_MS
    ) {
      void refreshMap();
    }
  };

  const start = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (startPromise) return startPromise;
    if (documentTarget && !listenerRegistered) {
      documentTarget.addEventListener("visibilitychange", onVisibilityChange);
      listenerRegistered = true;
    }

    startPromise = (async () => {
      let location = state.location;
      try {
        location = await resolveInitialLocation(options.bridge, now());
      } catch {
        // The initial demo coordinate remains usable when location fails.
      }
      if (disposed) return;
      state = { ...state, location: cloneState({
        ...state,
        location,
      }).location };
      locationResolved = true;
      emit("left");
      await Promise.all([refreshWeather(), refreshNews(), refreshMap()]);
    })();
    return startPromise;
  };

  return {
    start,
    getState: () => cloneState(state),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (documentTarget && listenerRegistered) {
        documentTarget.removeEventListener(
          "visibilitychange",
          onVisibilityChange,
        );
      }
    },
  };
}
