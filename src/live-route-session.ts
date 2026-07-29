import type {
  Coordinate,
  LiveDashboardState,
  RouteValue,
} from "./live-state";
import type { LocationBridge } from "./location";
import {
  clearActiveRouteCache,
  distanceBucket,
  distanceToRouteMeters,
  readActiveRouteCache,
  routeProgress,
  writeActiveRouteCache,
} from "./navigation";
import {
  requestRoute,
  RoutingError,
  type Destination,
  type RouteProfile,
  type RoutingStatus,
} from "./routing";
import type {
  LiveRefreshTarget,
} from "./live-dashboard-refresh";

type LocationMode = "general" | "navigation";

type LiveRouteSessionOptions = {
  readonly bridge: LocationBridge;
  readonly routingStatus?: RoutingStatus;
  readonly isRoutingEnabled: () => boolean;
  readonly getRoutingKey: () => string | undefined;
  readonly fetchImpl: typeof fetch;
  readonly now: () => number;
  readonly getState: () => LiveDashboardState;
  readonly setRoute: (route: LiveDashboardState["route"]) => void;
  readonly emit: (target: LiveRefreshTarget) => void;
  readonly isDisposed: () => boolean;
  readonly ensureStarted: () => Promise<void>;
  readonly setLocationMode: (mode: LocationMode) => Promise<boolean>;
};

export function createLiveRouteSession(options: LiveRouteSessionOptions) {
  let activeDestination: Destination | undefined;
  let routeSessionActive = false;
  let offRouteFixes = 0;
  let lastRerouteAt = Number.NEGATIVE_INFINITY;
  let reroutePromise: Promise<void> | undefined;
  let routeGeneration = 0;
  let routeCacheQueue: Promise<void> = Promise.resolve();

  const queueRouteCacheOperation = (
    operation: () => Promise<unknown>,
  ): Promise<void> => {
    const pending = routeCacheQueue.then(async () => {
      await operation();
    });
    routeCacheQueue = pending.catch(() => undefined);
    return routeCacheQueue;
  };

  const ownsRoute = (
    generation: number,
    destination: Destination,
  ): boolean => (
    !options.isDisposed()
    && routeGeneration === generation
    && routeSessionActive
    && activeDestination?.id === destination.id
  );

  const activeRoute = (): RouteValue | undefined => (
    routeSessionActive ? options.getState().route.value : undefined
  );

  const reroute = (coordinate: Coordinate): Promise<void> => {
    const currentRoute = activeRoute();
    if (reroutePromise || !activeDestination || !currentRoute) {
      return reroutePromise ?? Promise.resolve();
    }
    const destination = activeDestination;
    const previousRoute = currentRoute;
    const generation = routeGeneration;
    reroutePromise = (async () => {
      try {
        const route = await requestRoute({
          start: coordinate,
          destination,
          profile: previousRoute.profile,
        }, options.fetchImpl, options.getRoutingKey());
        if (!ownsRoute(generation, destination)) return;
        const fetchedAt = options.now();
        options.setRoute({ status: "fresh", value: route, fetchedAt });
        lastRerouteAt = fetchedAt;
        offRouteFixes = 0;
        await queueRouteCacheOperation(
          () => writeActiveRouteCache(
            options.bridge,
            destination,
            route,
            fetchedAt,
          ),
        );
        if (ownsRoute(generation, destination)) options.emit("all");
      } catch {
        if (!ownsRoute(generation, destination)) return;
        lastRerouteAt = options.now();
        offRouteFixes = 0;
        options.setRoute({
          status: "stale",
          value: previousRoute,
          fetchedAt: options.getState().route.fetchedAt,
        });
        options.emit("right");
      }
    })().finally(() => {
      reroutePromise = undefined;
    });
    return reroutePromise;
  };

  const updateProgress = (coordinate: Coordinate): boolean => {
    const route = activeRoute();
    if (!route) return false;
    const progress = routeProgress(route, coordinate);
    const changed = progress.activeManeuverIndex
      !== route.activeManeuverIndex
      || distanceBucket(progress.remainingDistance)
        !== distanceBucket(route.remainingDistance);
    options.setRoute({
      ...options.getState().route,
      value: progress,
    });
    offRouteFixes = distanceToRouteMeters(
      coordinate,
      progress.geometry,
    ) > 35
      ? offRouteFixes + 1
      : 0;
    return changed;
  };

  const maybeReroute = async (coordinate: Coordinate) => {
    if (
      activeRoute()
      && offRouteFixes >= 3
      && options.now() - lastRerouteAt >= 30_000
    ) {
      await reroute(coordinate);
    }
  };

  const restore = async (): Promise<boolean> => {
    if (!options.isRoutingEnabled()) return false;
    const cached = await readActiveRouteCache(
      options.bridge,
      options.now(),
    );
    if (options.isDisposed() || !cached) return false;
    activeDestination = cached.destination;
    options.setRoute({
      status: "stale",
      value: cached.route,
      fetchedAt: cached.fetchedAt,
    });
    return true;
  };

  const startRoute = async (
    destination: Destination,
    profile: RouteProfile,
  ) => {
    if (
      !options.isRoutingEnabled()
      || options.getState().route.status === "disabled"
    ) {
      throw new RoutingError(
        "ROUTING_DISABLED",
        "ORS 키 연결 후 길찾기를 사용할 수 있습니다.",
      );
    }
    await options.ensureStarted();
    if (options.isDisposed()) {
      throw new RoutingError(
        "ROUTING_UNAVAILABLE",
        "길찾기 세션이 종료되었습니다.",
      );
    }
    const location = options.getState().location.value;
    if (!location || location.source === "demo") {
      throw new RoutingError(
        "LOCATION_UNAVAILABLE",
        "현재 위치를 확인할 수 없습니다.",
      );
    }
    const coordinate = location.coordinate;

    const previousRoute = options.getState().route.value;
    const previousFetchedAt = options.getState().route.fetchedAt;
    const previousDestination = activeDestination;
    const previousSessionActive = routeSessionActive;
    const generation = ++routeGeneration;
    options.setRoute({
      status: "loading",
      ...(previousRoute ? { value: previousRoute } : {}),
      ...(previousFetchedAt !== undefined
        ? { fetchedAt: previousFetchedAt }
        : {}),
    });
    options.emit("right");
    try {
      const route = await requestRoute({
        start: coordinate,
        destination,
        profile,
      }, options.fetchImpl, options.getRoutingKey());
      if (
        options.isDisposed()
        || generation !== routeGeneration
      ) {
        return;
      }
      const fetchedAt = options.now();
      activeDestination = destination;
      routeSessionActive = true;
      offRouteFixes = 0;
      lastRerouteAt = fetchedAt;
      options.setRoute({ status: "fresh", value: route, fetchedAt });
      await queueRouteCacheOperation(
        () => writeActiveRouteCache(
          options.bridge,
          destination,
          route,
          fetchedAt,
        ),
      );
      if (!ownsRoute(generation, destination)) return;
      options.emit("all");
      if (!await options.setLocationMode("navigation")) {
        await options.setLocationMode("general");
      }
    } catch (error) {
      if (generation !== routeGeneration) return;
      if (!options.isDisposed()) {
        activeDestination = previousDestination;
        routeSessionActive = previousSessionActive;
        options.setRoute(previousRoute
          ? {
            status: "stale",
            value: previousRoute,
            fetchedAt: previousFetchedAt,
          }
          : { status: "fresh" });
        options.emit("right");
      }
      throw error;
    }
  };

  const endRoute = async () => {
    const generation = ++routeGeneration;
    routeSessionActive = false;
    activeDestination = undefined;
    offRouteFixes = 0;
    await queueRouteCacheOperation(
      () => clearActiveRouteCache(options.bridge),
    );
    if (
      options.isDisposed()
      || generation !== routeGeneration
    ) {
      return;
    }
    options.setRoute(options.isRoutingEnabled()
      ? { status: "fresh" }
      : { status: "disabled" });
    options.emit("all");
    await options.setLocationMode("general");
  };

  const resumeRoute = async () => {
    const destination = activeDestination;
    const profile = options.getState().route.value?.profile;
    if (!destination || !profile) {
      throw new RoutingError(
        "ROUTE_UNAVAILABLE",
        "다시 시작할 이전 경로가 없습니다.",
      );
    }
    await startRoute(destination, profile);
  };

  return {
    restore,
    activeRoute,
    updateProgress,
    maybeReroute,
    startRoute,
    resumeRoute,
    endRoute,
    dispose: () => {
      routeSessionActive = false;
      routeGeneration += 1;
    },
  };
}
