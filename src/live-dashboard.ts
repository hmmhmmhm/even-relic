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
import { resolveTodos, toggleTodo, writeTodos } from "./todos";
import { WEATHER_MAX_AGE_MS } from "./weather";
import { logDiagnostic } from "./diagnostic-log";

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

function mergeTarget(
  first: LiveRefreshTarget | undefined,
  second: LiveRefreshTarget,
): LiveRefreshTarget {
  if (!first || first === second) return second;
  return "all";
}

function todosMatch(
  left: LiveDashboardState["todos"]["value"],
  right: LiveDashboardState["todos"]["value"],
): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return item.id === other.id
      && item.title === other.title
      && item.completed === other.completed;
  });
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
  toggleTodo(index: number): Promise<boolean>;
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
  let locationEventCount = 0;
  let pendingLocationCount = 0;

  const emit = (target: LiveRefreshTarget) => {
    if (disposed) return;
    try {
      options.onUpdate({ state: clone(state), target });
      logDiagnostic("LIVE", `dashboard emitted · ${target}`);
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `dashboard update callback failed · ${diagnosticErrorKind(error)}`,
      );
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
    logDiagnostic("LOCATION", "stream stop requested");
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
      const stopped = await options.bridge.stopAppLocationUpdates();
      logDiagnostic(
        "LOCATION",
        `stream stop ${stopped ? "success" : "rejected"}`,
      );
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `location stream stop failed · ${diagnosticErrorKind(error)}`,
      );
      // A failed stop must not block cleanup or a later restart attempt.
    }
  };

  let routeSession: ReturnType<typeof createLiveRouteSession>;

  const queueLocation = (location: AppLocation) => {
    locationEventCount += 1;
    pendingLocationCount += 1;
    const eventId = locationEventCount;
    logDiagnostic(
      "LOCATION",
      `raw #${eventId} · pending ${pendingLocationCount}`
        + ` · accuracy=${Number.isFinite(location.accuracy) ? "yes" : "no"}`
        + ` · speed=${Number.isFinite(location.speed) ? "yes" : "no"}`
        + ` · heading=${Number.isFinite(location.heading) ? "yes" : "no"}`,
    );
    locationQueue = locationQueue
      .then(async () => {
        const startedAt = diagnosticNow();
        logDiagnostic("LOCATION", `process #${eventId} start`);
        try {
          if (disposed) {
            logDiagnostic("LOCATION", `process #${eventId} skipped · disposed`);
            return;
          }
          const next = normalizeLiveLocation(location, now());
          const previousCoordinate = state.location.value?.coordinate;
          const nextCoordinate = next?.value?.coordinate;
          if (!next || !nextCoordinate) {
            logDiagnostic("LOCATION", "ignored · invalid");
            return;
          }
          const activeRoute = routeSession.activeRoute();
          const movement = previousCoordinate
            ? haversineMeters(previousCoordinate, nextCoordinate)
            : Number.POSITIVE_INFINITY;
          const minimumMovement = activeRoute
            ? 5
            : LOCATION_UPDATE_DISTANCE_METERS;
          if (movement < minimumMovement) {
            logDiagnostic(
              "LOCATION",
              `ignored · movement ${Math.round(movement)}m`
                + ` < ${minimumMovement}m`,
            );
            return;
          }

          state = { ...state, location: clone(next) };
          let target: LiveRefreshTarget | undefined;
          const redrawMap = movement >= LOCATION_UPDATE_DISTANCE_METERS;
          if (redrawMap) target = "left";
          if (routeSession.updateProgress(nextCoordinate)) {
            target = mergeTarget(target, "right");
          }

          logDiagnostic(
            "LOCATION",
            `accepted · movement ${
              Number.isFinite(movement) ? `${Math.round(movement)}m` : "initial"
            } · target ${target ?? "none"}`,
          );
          if (target) emit(target);
          const persistStartedAt = diagnosticNow();
          logDiagnostic("LOCATION", "persistence queued");
          void persistLiveLocation(options.bridge, next).then((persisted) => {
            logDiagnostic(
              "LOCATION",
              `persistence ${persisted ? "success" : "rejected"}`,
              diagnosticDuration(persistStartedAt),
            );
          });
          if (
            redrawMap
            && state.map.value?.cell !== clientMapCell(nextCoordinate)
          ) {
            logDiagnostic("LOCATION", "map cell refresh requested");
            await refresh.refreshMap();
          }
          await routeSession.maybeReroute(nextCoordinate);
        } catch (error) {
          logDiagnostic(
            "ERROR",
            `location process #${eventId} failed · ${diagnosticErrorKind(error)}`,
            diagnosticDuration(startedAt),
          );
        } finally {
          pendingLocationCount -= 1;
          logDiagnostic(
            "LOCATION",
            `process #${eventId} complete · pending ${pendingLocationCount}`,
            diagnosticDuration(startedAt),
          );
        }
      })
      .catch((error: unknown) => {
        pendingLocationCount = Math.max(0, pendingLocationCount - 1);
        logDiagnostic(
          "ERROR",
          `location queue failed · ${diagnosticErrorKind(error)}`,
        );
      });
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
      logDiagnostic("LOCATION", "stream unavailable");
      return false;
    }
    if (locationUpdatesStarted && locationUpdateMode === mode) {
      logDiagnostic("LOCATION", `stream already active · ${mode}`);
      return true;
    }
    if (locationUpdatesStarted) await stopLocationUpdates();

    const startedAt = diagnosticNow();
    logDiagnostic("LOCATION", `stream start requested · ${mode}`);
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
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `location stream start failed · ${diagnosticErrorKind(error)}`,
        diagnosticDuration(startedAt),
      );
      return false;
    }
    if (!started) {
      logDiagnostic(
        "LOCATION",
        `stream start rejected · ${mode}`,
        diagnosticDuration(startedAt),
      );
      return false;
    }
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
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `location listener failed · ${diagnosticErrorKind(error)}`,
      );
      await stopLocationUpdates();
      return false;
    }
    logDiagnostic(
      "LOCATION",
      `stream active · ${mode}`,
      diagnosticDuration(startedAt),
    );
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
    logDiagnostic("LIVE", "visibility refresh check");
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
    if (disposed) {
      logDiagnostic("LIVE", "session start skipped · disposed");
      return Promise.resolve();
    }
    if (startPromise) {
      logDiagnostic("LIVE", "session start joined");
      return startPromise;
    }
    logDiagnostic("LIVE", "session start");
    if (documentTarget && !listenerRegistered) {
      documentTarget.addEventListener("visibilitychange", onVisibilityChange);
      listenerRegistered = true;
    }
    startPromise = (async () => {
      const todos = await resolveTodos(options.bridge);
      if (disposed) return;
      if (!todosMatch(state.todos.value, todos)) {
        state = {
          ...state,
          todos: { status: "fresh", value: clone(todos) },
        };
        emit("right");
      }

      let location = state.location;
      try {
        location = await resolveInitialLocation(options.bridge, now());
      } catch (error) {
        logDiagnostic(
          "ERROR",
          `initial location failed · ${diagnosticErrorKind(error)}`,
        );
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
      logDiagnostic("LIVE", "session ready");
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

  const toggleTodoAt = async (index: number): Promise<boolean> => {
    if (disposed) return false;
    const current = state.todos.value ?? [];
    const next = toggleTodo(current, index);
    if (next === current) return false;
    state = {
      ...state,
      todos: { status: "fresh", value: clone(next) },
    };
    emit("right");
    await writeTodos(options.bridge, next);
    return true;
  };

  return {
    start,
    startRoute: routeSession.startRoute,
    resumeRoute: routeSession.resumeRoute,
    endRoute: routeSession.endRoute,
    toggleTodo: toggleTodoAt,
    getState: () => clone(state),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      logDiagnostic("LIVE", "session dispose");
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
