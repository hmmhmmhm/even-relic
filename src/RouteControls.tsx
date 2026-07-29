import {
  useState,
  type FormEvent,
} from "react";
import type { DataStatus, RouteValue } from "./live-state";
import {
  RoutingError,
  searchDestinations,
  type Destination,
  type RouteProfile,
  type RoutingStatus,
} from "./routing";
import type { PhoneLocale } from "./phone-types";

type RouteControlsProps = {
  readonly locale?: PhoneLocale;
  readonly status: RoutingStatus;
  readonly activeRoute?: RouteValue;
  readonly routeStatus?: DataStatus;
  readonly onStart: (
    destination: Destination,
    profile: RouteProfile,
  ) => void | Promise<void>;
  readonly onEnd: () => void | Promise<void>;
  readonly onResume?: () => void | Promise<void>;
  readonly orsKey?: string;
  readonly search?: (query: string) => ReturnType<typeof searchDestinations>;
};

const ROUTE_COPY = {
  en: {
    navigation: "Navigation",
    disabledHelp: "Connect an ORS key to enable navigation.",
    minimumQuery: "Enter at least two characters.",
    searchFailed: "Could not search destinations. Try again.",
    endFailed: "Could not end navigation. Try again.",
    startFailed: "Could not start the route. Try again.",
    previousRoute: "previous route",
    navigating: "navigating",
    resume: "Resume navigation",
    end: "End navigation",
    destinationSearch: "Destination search",
    destination: "Destination",
    profile: "Travel mode",
    searching: "Searching",
    search: "Search",
    searchResults: "Search results",
    profiles: {
      "foot-walking": "Walking",
      "cycling-regular": "Cycling",
      "driving-car": "Driving",
    },
  },
  ko: {
    navigation: "길찾기",
    disabledHelp: "ORS 키 연결 후 길찾기 사용 가능",
    minimumQuery: "목적지를 두 글자 이상 입력하세요.",
    searchFailed: "목적지를 검색하지 못했습니다. 다시 시도하세요.",
    endFailed: "길찾기를 종료하지 못했습니다. 다시 시도하세요.",
    startFailed: "경로를 시작하지 못했습니다. 다시 시도하세요.",
    previousRoute: "이전 경로",
    navigating: "안내 중",
    resume: "길찾기 다시 시작",
    end: "길찾기 종료",
    destinationSearch: "목적지 검색",
    destination: "목적지",
    profile: "이동 방식",
    searching: "검색 중",
    search: "검색",
    searchResults: "검색 결과",
    profiles: {
      "foot-walking": "도보",
      "cycling-regular": "자전거",
      "driving-car": "자동차",
    },
  },
} as const;

const PROFILE_VALUES: readonly RouteProfile[] = [
  "foot-walking",
  "cycling-regular",
  "driving-car",
];

function conciseError(
  error: unknown,
  action: "search" | "start" | "end",
  copy: typeof ROUTE_COPY[PhoneLocale],
) {
  if (error instanceof RoutingError && error.disabled) {
    return copy.disabledHelp;
  }
  if (action === "search") {
    return copy.searchFailed;
  }
  if (action === "end") {
    return copy.endFailed;
  }
  return copy.startFailed;
}

export function RouteControls({
  locale = "ko",
  status,
  activeRoute,
  routeStatus = "fresh",
  onStart,
  onEnd,
  onResume,
  orsKey,
  search,
}: RouteControlsProps) {
  const copy = ROUTE_COPY[locale];
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<RouteProfile>("foot-walking");
  const [results, setResults] = useState<readonly Destination[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!status.enabled) {
    return (
      <section className="route-controls" aria-label={copy.navigation}>
        <strong>ROUTE // DISABLED</strong>
        <p>{copy.disabledHelp}</p>
      </section>
    );
  }

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    if ([...normalized].length < 2) {
      setError(copy.minimumQuery);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const destinations = search
        ? await search(normalized)
        : await searchDestinations(normalized, fetch, orsKey);
      setResults(destinations.slice(0, 5));
    } catch (caught) {
      setError(conciseError(caught, "search", copy));
    } finally {
      setBusy(false);
    }
  };

  const start = async (destination: Destination) => {
    setBusy(true);
    setError(undefined);
    try {
      await onStart(destination, profile);
    } catch (caught) {
      setError(conciseError(caught, "start", copy));
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await onEnd();
    } catch (caught) {
      setError(conciseError(caught, "end", copy));
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!onResume) return;
    setBusy(true);
    setError(undefined);
    try {
      await onResume();
    } catch (caught) {
      setError(conciseError(caught, "start", copy));
    } finally {
      setBusy(false);
    }
  };

  if (activeRoute) {
    const stale = routeStatus === "stale";
    return (
      <section className="route-controls" aria-label={copy.navigation}>
        <strong>{stale ? "ROUTE // STALE" : "ROUTE // ACTIVE"}</strong>
        <p>
          {activeRoute.destinationName}{" "}
          {stale ? copy.previousRoute : copy.navigating}
        </p>
        <div className="route-actions">
          {stale && onResume && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void resume()}
            >
              {copy.resume}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void end()}>
            {copy.end}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="route-controls" aria-label={copy.navigation}>
      <strong>ROUTE // READY</strong>
      <form
        aria-label={copy.destinationSearch}
        onSubmit={(event) => void submitSearch(event)}
      >
        <label>
          {copy.destination}
          <input
            value={query}
            disabled={busy}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          {copy.profile}
          <select
            value={profile}
            disabled={busy}
            onChange={(event) => {
              setProfile(event.target.value as RouteProfile);
            }}
          >
            {PROFILE_VALUES.map((value) => (
              <option key={value} value={value}>
                {copy.profiles[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy}>
          {busy ? copy.searching : copy.search}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {results.length > 0 && (
        <div className="route-results" aria-label={copy.searchResults}>
          {results.map((destination) => (
            <button
              key={destination.id}
              type="button"
              disabled={busy}
              onClick={() => void start(destination)}
            >
              <strong>{destination.name}</strong>
              <span>{destination.label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
