import {
  AppLocationAccuracy,
  type AppLocation,
} from "@evenrealities/even_hub_sdk";
import { logDiagnostic } from "./diagnostic-log";
import {
  haversineMeters,
  LOCATION_UPDATE_DISTANCE_METERS,
  LOCATION_UPDATE_INTERVAL_MS,
  normalizeLiveLocation,
  persistLiveLocation,
  type LocationBridge,
} from "./location";
import type { LiveDashboardState } from "./live-state";
import type { LiveRefreshTarget } from "./live-dashboard-refresh";
import type { createLiveRouteSession } from "./live-route-session";
import { clientMapCell } from "./map";

type RouteSession = Pick<
  ReturnType<typeof createLiveRouteSession>,
  "activeRoute" | "maybeReroute" | "updateProgress"
>;

type LiveLocationStreamOptions = {
  readonly bridge: LocationBridge;
  readonly now: () => number;
  readonly getState: () => LiveDashboardState;
  readonly setState: (state: LiveDashboardState) => void;
  readonly emit: (target: LiveRefreshTarget) => void;
  readonly refreshMap: () => Promise<void>;
  readonly getRouteSession: () => RouteSession;
  readonly isDisposed: () => boolean;
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

export function createLiveLocationStream(
  options: LiveLocationStreamOptions,
) {
  let started = false;
  let mode: "general" | "navigation" | undefined;
  let unsubscribe: (() => void) | undefined;
  let eventCount = 0;
  let busy = false;

  const stop = async () => {
    logDiagnostic("LOCATION", "stream stop requested");
    unsubscribe?.();
    unsubscribe = undefined;
    if (!started || !options.bridge.stopAppLocationUpdates) return;
    started = false;
    mode = undefined;
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
    }
  };

  const process = async (location: AppLocation, eventId: number) => {
    if (options.isDisposed()) {
      logDiagnostic("LOCATION", `process #${eventId} skipped · disposed`);
      return;
    }
    const next = normalizeLiveLocation(location, options.now());
    const state = options.getState();
    const previousCoordinate = state.location.value?.coordinate;
    const nextCoordinate = next?.value?.coordinate;
    if (!next || !nextCoordinate) {
      logDiagnostic("LOCATION", "ignored · invalid");
      return;
    }
    const routeSession = options.getRouteSession();
    const movement = previousCoordinate
      ? haversineMeters(previousCoordinate, nextCoordinate)
      : Number.POSITIVE_INFINITY;
    const minimumMovement = routeSession.activeRoute()
      ? 5
      : LOCATION_UPDATE_DISTANCE_METERS;
    if (movement < minimumMovement) {
      logDiagnostic(
        "LOCATION",
        `ignored · movement ${Math.round(movement)}m < ${minimumMovement}m`,
      );
      return;
    }

    options.setState({ ...state, location: clone(next) });
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
    if (target) options.emit(target);

    const persistStartedAt = diagnosticNow();
    logDiagnostic("LOCATION", "persistence start");
    void persistLiveLocation(options.bridge, next).then((persisted) => {
      logDiagnostic(
        "LOCATION",
        `persistence ${persisted ? "success" : "rejected"}`,
        diagnosticDuration(persistStartedAt),
      );
    });
    if (
      redrawMap
      && options.getState().map.value?.cell
        !== clientMapCell(nextCoordinate)
    ) {
      logDiagnostic("LOCATION", "map cell refresh requested");
      await options.refreshMap();
    }
    await routeSession.maybeReroute(nextCoordinate);
  };

  const handle = (location: AppLocation) => {
    eventCount += 1;
    const eventId = eventCount;
    if (options.isDisposed() || busy) {
      logDiagnostic(
        "LOCATION",
        `raw #${eventId} busy drop · ${
          options.isDisposed() ? "disposed" : "active"
        }`,
      );
      return;
    }
    busy = true;
    const startedAt = diagnosticNow();
    logDiagnostic(
      "LOCATION",
      `raw #${eventId} accepted`
        + ` · accuracy=${Number.isFinite(location.accuracy) ? "yes" : "no"}`
        + ` · speed=${Number.isFinite(location.speed) ? "yes" : "no"}`
        + ` · heading=${Number.isFinite(location.heading) ? "yes" : "no"}`,
    );
    void process(location, eventId)
      .catch((error: unknown) => {
        logDiagnostic(
          "ERROR",
          `location process #${eventId} failed · ${
            diagnosticErrorKind(error)
          }`,
          diagnosticDuration(startedAt),
        );
      })
      .finally(() => {
        busy = false;
        logDiagnostic(
          "LOCATION",
          `process #${eventId} complete`,
          diagnosticDuration(startedAt),
        );
      });
  };

  const start = async (
    nextMode: "general" | "navigation" = "general",
  ): Promise<boolean> => {
    const {
      onAppLocationChanged,
      startAppLocationUpdates,
      stopAppLocationUpdates,
    } = options.bridge;
    if (
      options.isDisposed()
      || !onAppLocationChanged
      || !startAppLocationUpdates
      || !stopAppLocationUpdates
    ) {
      logDiagnostic("LOCATION", "stream unavailable");
      return false;
    }
    if (started && mode === nextMode) {
      logDiagnostic("LOCATION", `stream already active · ${nextMode}`);
      return true;
    }
    if (started) await stop();

    const startedAt = diagnosticNow();
    logDiagnostic("LOCATION", `stream start requested · ${nextMode}`);
    let accepted = false;
    try {
      accepted = await startAppLocationUpdates.call(options.bridge, {
        accuracy: AppLocationAccuracy.Medium,
        intervalMs: nextMode === "navigation"
          ? 2_000
          : LOCATION_UPDATE_INTERVAL_MS,
        distanceFilter: nextMode === "navigation"
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
    if (!accepted) {
      logDiagnostic(
        "LOCATION",
        `stream start rejected · ${nextMode}`,
        diagnosticDuration(startedAt),
      );
      return false;
    }
    started = true;
    mode = nextMode;
    if (options.isDisposed()) {
      await stop();
      return false;
    }
    try {
      unsubscribe = onAppLocationChanged.call(options.bridge, handle);
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `location listener failed · ${diagnosticErrorKind(error)}`,
      );
      await stop();
      return false;
    }
    logDiagnostic(
      "LOCATION",
      `stream active · ${nextMode}`,
      diagnosticDuration(startedAt),
    );
    return true;
  };

  return { start, stop };
}
