import {
  createInitialLiveDashboardState,
  type DataState,
  type LiveDashboardState,
  type WeatherValue,
} from "./live-state";
import {
  resolveInitialLocation,
  type LocationBridge,
} from "./location";
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

function isUnchangedFreshCache(
  left: DataState<WeatherValue> | undefined,
  right: DataState<WeatherValue>,
): boolean {
  return left?.status === "fresh"
    && JSON.stringify(left) === JSON.stringify(right);
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
      if (disposed || isUnchangedFreshCache(cachedWeather, result)) return;
      setWeather(result);
      emit("right");
    })().finally(() => {
      weatherPromise = undefined;
    });
    return weatherPromise;
  };

  const onVisibilityChange = () => {
    if (
      disposed
      || !locationResolved
      || documentTarget?.visibilityState !== "visible"
      || weatherPromise
    ) {
      return;
    }
    const fetchedAt = state.weather.fetchedAt;
    if (fetchedAt === undefined || now() - fetchedAt >= WEATHER_MAX_AGE_MS) {
      void refreshWeather();
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
      await refreshWeather();
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
