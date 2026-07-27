import {
  AppLocationAccuracy,
  type AppLocation,
} from "@evenrealities/even_hub_sdk";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
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
  createLiveDashboardRefresh,
  type LiveRefreshTarget,
} from "./live-dashboard-refresh";
import { createLiveRouteSession } from "./live-route-session";
import { clientMapCell, MAP_MAX_AGE_MS } from "./map";
import { NEWS_MAX_AGE_MS } from "./news";
import type {
  Destination,
  RouteProfile,
  RoutingStatus,
} from "./routing";
import { WEATHER_MAX_AGE_MS } from "./weather";

export type LiveDashboardUpdate = {
  readonly state: LiveDashboardState;
  readonly target: LiveRefreshTarget;
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeTarget(
  first: LiveRefreshTarget | undefined,
  second: LiveRefreshTarget,
): LiveRefreshTarget {
  if (!first || first === second) return second;
  return "all";
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
  let locationUpdatesStarted = false;
  let locationUpdateMode: "general" | "navigation" | undefined;
  let unsubscribeLocation: (() => void) | undefined;
  let locationQueue = Promise.resolve();

  const emit = (target: LiveRefreshTarget) => {
    if (disposed) return;
    try {
      options.onUpdate({ state: clone(state), target });
    } catch {
      // A preview/render callback must not stop the live-data session.
    }
  };
  const setRoute = (route: LiveDashboardState["route"]) => {
    state = { ...state, route: clone(route) };
  };

  const refresh = createLiveDashboardRefresh({
    bridge: options.bridge,
    fetchImpl,
    now,
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    emit,
    isDisposed: () => disposed,
  });

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

  let routeSession: ReturnType<typeof createLiveRouteSession>;

  const queueLocation = (location: AppLocation) => {
    locationQueue = locationQueue
      .then(async () => {
        if (disposed) return;
        const next = normalizeLiveLocation(location, now());
        const previousCoordinate = state.location.value?.coordinate;
        const nextCoordinate = next?.value?.coordinate;
        const activeRoute = routeSession.activeRoute();
        const movement = previousCoordinate && nextCoordinate
          ? haversineMeters(previousCoordinate, nextCoordinate)
          : Number.POSITIVE_INFINITY;
        if (
          !next
          || !nextCoordinate
          || movement < (activeRoute
            ? 5
            : LOCATION_UPDATE_DISTANCE_METERS)
        ) {
          return;
        }

        state = { ...state, location: clone(next) };
        let target: LiveRefreshTarget | undefined;
        const redrawMap = movement >= LOCATION_UPDATE_DISTANCE_METERS;
        if (redrawMap) target = "left";
        if (routeSession.updateProgress(nextCoordinate)) {
          target = mergeTarget(target, "right");
        }

        if (target) emit(target);
        void persistLiveLocation(options.bridge, next);
        if (
          redrawMap
          && state.map.value?.cell !== clientMapCell(nextCoordinate)
        ) {
          await refresh.refreshMap();
        }
        await routeSession.maybeReroute(nextCoordinate);
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
    if (
      state.weather.fetchedAt === undefined
      || currentTime - state.weather.fetchedAt >= WEATHER_MAX_AGE_MS
    ) {
      void refresh.refreshWeather();
    }
    if (
      state.news.fetchedAt === undefined
      || currentTime - state.news.fetchedAt >= NEWS_MAX_AGE_MS
    ) {
      void refresh.refreshNews();
    }
    if (
      state.map.fetchedAt === undefined
      || currentTime - state.map.fetchedAt >= MAP_MAX_AGE_MS
    ) {
      void refresh.refreshMap();
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
        // The demo coordinate remains usable when initial location fails.
      }
      if (disposed) return;
      state = { ...state, location: clone(location) };
      locationResolved = true;
      emit(await routeSession.restore() ? "all" : "left");
      await Promise.all([
        refresh.refreshWeather(),
        refresh.refreshNews(),
        refresh.refreshMap(),
      ]);
      await startLocationUpdates();
    })();
    return startPromise;
  };

  routeSession = createLiveRouteSession({
    bridge: options.bridge,
    routingStatus: options.routingStatus,
    fetchImpl,
    now,
    getState: () => state,
    setRoute,
    emit,
    isDisposed: () => disposed,
    ensureStarted: start,
    setLocationMode: startLocationUpdates,
  });

  return {
    start,
    startRoute: routeSession.startRoute,
    resumeRoute: routeSession.resumeRoute,
    endRoute: routeSession.endRoute,
    getState: () => clone(state),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      routeSession.dispose();
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
