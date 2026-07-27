import {
  AppLocationAccuracy,
  type AppLocation,
} from "@evenrealities/even_hub_sdk";
import {
  createInitialLiveDashboardState,
  type DataState,
  type LiveDashboardState,
  type MapValue,
  type NewsItem,
  type WeatherValue,
} from "./live-state";
import {
  haversineMeters,
  LOCATION_UPDATE_DISTANCE_METERS,
  LOCATION_UPDATE_INTERVAL_MS,
  normalizeLiveLocation,
  persistLiveLocation,
  resolveInitialLocation,
  type LocationBridge,
} from "./location";
import {
  clientMapCell,
  MAP_MAX_AGE_MS,
  resolveMap,
} from "./map";
import {
  clearActiveRouteCache,
  distanceBucket,
  distanceToRouteMeters,
  readActiveRouteCache,
  routeProgress,
  writeActiveRouteCache,
} from "./navigation";
import { NEWS_MAX_AGE_MS, resolveNews } from "./news";
import {
  RoutingError,
  requestRoute,
  type Destination,
  type RouteProfile,
  type RoutingStatus,
} from "./routing";
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
  readonly routingStatus?: RoutingStatus;
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
  startRoute(
    destination: Destination,
    profile: RouteProfile,
  ): Promise<void>;
  resumeRoute(): Promise<void>;
  endRoute(): Promise<void>;
  getState(): LiveDashboardState;
  dispose(): void;
} {
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;
  const documentTarget = options.documentTarget
    ?? (typeof document === "undefined" ? undefined : document);
  let state: LiveDashboardState = {
    ...createInitialLiveDashboardState(),
    route: options.routingStatus?.enabled
      ? { status: "fresh" }
      : { status: "disabled" },
  };
  let disposed = false;
  let listenerRegistered = false;
  let locationResolved = false;
  let startPromise: Promise<void> | undefined;
  let weatherPromise: Promise<void> | undefined;
  let newsPromise: Promise<void> | undefined;
  let mapPromise: Promise<void> | undefined;
  let locationUpdatesStarted = false;
  let locationUpdateMode: "general" | "navigation" | undefined;
  let unsubscribeLocation: (() => void) | undefined;
  let locationQueue = Promise.resolve();
  let activeDestination: Destination | undefined;
  let routeSessionActive = false;
  let offRouteFixes = 0;
  let lastRerouteAt = Number.NEGATIVE_INFINITY;
  let reroutePromise: Promise<void> | undefined;
  let routeGeneration = 0;

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
  const setRoute = (route: LiveDashboardState["route"]) => {
    state = { ...state, route: cloneState({
      ...state,
      route,
    }).route };
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
      const previousMap = state.map;
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
      if (result.status === "unavailable" && previousMap.value) {
        result = {
          status: "stale",
          value: previousMap.value,
          fetchedAt: previousMap.fetchedAt,
        };
      }
      if (disposed || isSameMapState(cachedMap, result)) return;
      setMap(result);
      emit("left");
    })().finally(() => {
      mapPromise = undefined;
    });
    return mapPromise;
  };

  const stopLocationUpdates = async () => {
    unsubscribeLocation?.();
    unsubscribeLocation = undefined;
    if (
      !locationUpdatesStarted
      || !options.bridge.stopAppLocationUpdates
    ) {
      return;
    }
    locationUpdatesStarted = false;
    locationUpdateMode = undefined;
    try {
      await options.bridge.stopAppLocationUpdates();
    } catch {
      // A failed stop must not block cleanup or a later restart attempt.
    }
  };

  const mergeTarget = (
    first: LiveDashboardUpdate["target"] | undefined,
    second: LiveDashboardUpdate["target"],
  ): LiveDashboardUpdate["target"] => {
    if (!first || first === second) return second;
    if (first === "all" || second === "all") return "all";
    return "all";
  };

  const reroute = (
    coordinate: NonNullable<
      LiveDashboardState["location"]["value"]
    >["coordinate"],
  ): Promise<void> => {
    if (
      reroutePromise
      || !routeSessionActive
      || !activeDestination
      || !state.route.value
    ) {
      return reroutePromise ?? Promise.resolve();
    }
    const destination = activeDestination;
    const previousRoute = state.route.value;
    const generation = routeGeneration;
    reroutePromise = (async () => {
      try {
        const route = await requestRoute({
          start: coordinate,
          destination,
          profile: previousRoute.profile,
        }, fetchImpl);
        if (
          disposed
          || routeGeneration !== generation
          || !routeSessionActive
          || activeDestination?.id !== destination.id
        ) {
          return;
        }
        const fetchedAt = now();
        setRoute({ status: "fresh", value: route, fetchedAt });
        lastRerouteAt = fetchedAt;
        offRouteFixes = 0;
        await writeActiveRouteCache(
          options.bridge,
          destination,
          route,
          fetchedAt,
        );
        emit("all");
      } catch {
        if (
          disposed
          || routeGeneration !== generation
          || !routeSessionActive
          || activeDestination?.id !== destination.id
        ) {
          return;
        }
        lastRerouteAt = now();
        offRouteFixes = 0;
        setRoute({
          status: "stale",
          value: previousRoute,
          fetchedAt: state.route.fetchedAt,
        });
        emit("right");
      }
    })().finally(() => {
      reroutePromise = undefined;
    });
    return reroutePromise;
  };

  const queueLocation = (location: AppLocation) => {
    locationQueue = locationQueue
      .then(async () => {
        if (disposed) return;
        const next = normalizeLiveLocation(location, now());
        const previousCoordinate = state.location.value?.coordinate;
        const nextCoordinate = next?.value?.coordinate;
        const activeRoute = routeSessionActive
          ? state.route.value
          : undefined;
        const movement = previousCoordinate && nextCoordinate
          ? haversineMeters(previousCoordinate, nextCoordinate)
          : Number.POSITIVE_INFINITY;
        const minimumMovement = activeRoute
          ? 5
          : LOCATION_UPDATE_DISTANCE_METERS;
        if (
          !next
          || !nextCoordinate
          || movement < minimumMovement
        ) {
          return;
        }

        state = { ...state, location: cloneState({
          ...state,
          location: next,
        }).location };
        let target: LiveDashboardUpdate["target"] | undefined;
        const redrawMap = movement >= LOCATION_UPDATE_DISTANCE_METERS;
        if (redrawMap) target = "left";

        if (activeRoute) {
          const progress = routeProgress(activeRoute, nextCoordinate);
          const maneuverChanged = progress.activeManeuverIndex
            !== activeRoute.activeManeuverIndex;
          const distanceChanged = distanceBucket(progress.remainingDistance)
            !== distanceBucket(activeRoute.remainingDistance);
          setRoute({
            ...state.route,
            value: progress,
          });
          if (maneuverChanged || distanceChanged) {
            target = mergeTarget(target, "right");
          }

          if (
            distanceToRouteMeters(nextCoordinate, progress.geometry) > 35
          ) {
            offRouteFixes += 1;
          } else {
            offRouteFixes = 0;
          }
        }

        if (target) emit(target);
        void persistLiveLocation(options.bridge, next);
        if (
          redrawMap
          && state.map.value?.cell !== clientMapCell(nextCoordinate)
        ) {
          await refreshMap();
        }
        if (
          activeRoute
          && offRouteFixes >= 3
          && now() - lastRerouteAt >= 30_000
        ) {
          await reroute(nextCoordinate);
        }
      })
      .catch(() => undefined);
  };

  const startLocationUpdates = async (
    mode: "general" | "navigation" = "general",
  ): Promise<boolean> => {
    const {
      onAppLocationChanged,
      startAppLocationUpdates,
      stopAppLocationUpdates,
    } = options.bridge;
    if (
      disposed
      || !onAppLocationChanged
      || !startAppLocationUpdates
      || !stopAppLocationUpdates
    ) {
      return false;
    }
    if (locationUpdatesStarted && locationUpdateMode === mode) return true;
    if (locationUpdatesStarted) await stopLocationUpdates();

    let started = false;
    try {
      started = await startAppLocationUpdates.call(options.bridge, {
        accuracy: AppLocationAccuracy.Medium,
        intervalMs: mode === "navigation"
          ? 2_000
          : LOCATION_UPDATE_INTERVAL_MS,
        distanceFilter: mode === "navigation"
          ? 5
          : LOCATION_UPDATE_DISTANCE_METERS,
      });
    } catch {
      return false;
    }
    if (!started) return false;
    locationUpdatesStarted = true;
    locationUpdateMode = mode;
    if (disposed) {
      await stopLocationUpdates();
      return false;
    }
    try {
      unsubscribeLocation = onAppLocationChanged.call(
        options.bridge,
        queueLocation,
      );
    } catch {
      await stopLocationUpdates();
      return false;
    }
    return true;
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
      const cachedRoute = options.routingStatus?.enabled
        ? await readActiveRouteCache(options.bridge, now())
        : undefined;
      if (disposed) return;
      if (cachedRoute) {
        activeDestination = cachedRoute.destination;
        setRoute({
          status: "stale",
          value: cachedRoute.route,
          fetchedAt: cachedRoute.fetchedAt,
        });
        emit("all");
      } else {
        emit("left");
      }
      await Promise.all([refreshWeather(), refreshNews(), refreshMap()]);
      await startLocationUpdates();
    })();
    return startPromise;
  };

  const startRoute = async (
    destination: Destination,
    profile: RouteProfile,
  ) => {
    if (!options.routingStatus?.enabled || state.route.status === "disabled") {
      throw new RoutingError(
        "ROUTING_DISABLED",
        "ORS 키 연결 후 길찾기를 사용할 수 있습니다.",
      );
    }
    await start();
    if (disposed) {
      throw new RoutingError(
        "ROUTING_UNAVAILABLE",
        "길찾기 세션이 종료되었습니다.",
      );
    }
    const coordinate = state.location.value?.coordinate;
    if (!coordinate) {
      throw new RoutingError(
        "LOCATION_UNAVAILABLE",
        "현재 위치를 확인할 수 없습니다.",
      );
    }

    const previousRoute = state.route.value;
    const previousFetchedAt = state.route.fetchedAt;
    const previousDestination = activeDestination;
    const previousSessionActive = routeSessionActive;
    const generation = ++routeGeneration;
    setRoute({
      status: "loading",
      ...(previousRoute ? { value: previousRoute } : {}),
      ...(previousFetchedAt !== undefined
        ? { fetchedAt: previousFetchedAt }
        : {}),
    });
    emit("right");
    try {
      const route = await requestRoute({
        start: coordinate,
        destination,
        profile,
      }, fetchImpl);
      if (disposed || generation !== routeGeneration) return;
      const fetchedAt = now();
      activeDestination = destination;
      routeSessionActive = true;
      offRouteFixes = 0;
      lastRerouteAt = fetchedAt;
      setRoute({ status: "fresh", value: route, fetchedAt });
      await writeActiveRouteCache(
        options.bridge,
        destination,
        route,
        fetchedAt,
      );
      emit("all");
      if (!await startLocationUpdates("navigation")) {
        await startLocationUpdates("general");
      }
    } catch (error) {
      if (generation !== routeGeneration) return;
      if (!disposed) {
        activeDestination = previousDestination;
        routeSessionActive = previousSessionActive;
        setRoute(previousRoute
          ? {
            status: "stale",
            value: previousRoute,
            fetchedAt: previousFetchedAt,
          }
          : { status: "fresh" });
        emit("right");
      }
      throw error;
    }
  };

  const endRoute = async () => {
    routeGeneration += 1;
    routeSessionActive = false;
    activeDestination = undefined;
    offRouteFixes = 0;
    await clearActiveRouteCache(options.bridge);
    if (disposed) return;
    setRoute(options.routingStatus?.enabled
      ? { status: "fresh" }
      : { status: "disabled" });
    emit("all");
    await startLocationUpdates("general");
  };

  const resumeRoute = async () => {
    const destination = activeDestination;
    const profile = state.route.value?.profile;
    if (!destination || !profile) {
      throw new RoutingError(
        "ROUTE_UNAVAILABLE",
        "다시 시작할 이전 경로가 없습니다.",
      );
    }
    await startRoute(destination, profile);
  };

  return {
    start,
    startRoute,
    resumeRoute,
    endRoute,
    getState: () => cloneState(state),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      routeGeneration += 1;
      void stopLocationUpdates();
      if (documentTarget && listenerRegistered) {
        documentTarget.removeEventListener(
          "visibilitychange",
          onVisibilityChange,
        );
      }
    },
  };
}
