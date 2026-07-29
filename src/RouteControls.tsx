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

type RouteControlsProps = {
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

const PROFILE_LABELS: ReadonlyArray<{
  readonly value: RouteProfile;
  readonly label: string;
}> = [
  { value: "foot-walking", label: "도보" },
  { value: "cycling-regular", label: "자전거" },
  { value: "driving-car", label: "자동차" },
];

function conciseError(error: unknown, action: "search" | "start" | "end") {
  if (error instanceof RoutingError && error.disabled) {
    return "ORS 키 연결 후 길찾기 사용 가능";
  }
  if (action === "search") {
    return "목적지를 검색하지 못했습니다. 다시 시도하세요.";
  }
  if (action === "end") {
    return "길찾기를 종료하지 못했습니다. 다시 시도하세요.";
  }
  return "경로를 시작하지 못했습니다. 다시 시도하세요.";
}

export function RouteControls({
  status,
  activeRoute,
  routeStatus = "fresh",
  onStart,
  onEnd,
  onResume,
  orsKey,
  search,
}: RouteControlsProps) {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<RouteProfile>("foot-walking");
  const [results, setResults] = useState<readonly Destination[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!status.enabled) {
    return (
      <section className="route-controls" aria-label="길찾기">
        <strong>ROUTE // DISABLED</strong>
        <p>ORS 키 연결 후 길찾기 사용 가능</p>
      </section>
    );
  }

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    if ([...normalized].length < 2) {
      setError("목적지를 두 글자 이상 입력하세요.");
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
      setError(conciseError(caught, "search"));
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
      setError(conciseError(caught, "start"));
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
      setError(conciseError(caught, "end"));
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
      setError(conciseError(caught, "start"));
    } finally {
      setBusy(false);
    }
  };

  if (activeRoute) {
    const stale = routeStatus === "stale";
    return (
      <section className="route-controls" aria-label="길찾기">
        <strong>{stale ? "ROUTE // STALE" : "ROUTE // ACTIVE"}</strong>
        <p>
          {activeRoute.destinationName} {stale ? "이전 경로" : "안내 중"}
        </p>
        <div className="route-actions">
          {stale && onResume && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void resume()}
            >
              길찾기 다시 시작
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void end()}>
            길찾기 종료
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="route-controls" aria-label="길찾기">
      <strong>ROUTE // READY</strong>
      <form
        aria-label="목적지 검색"
        onSubmit={(event) => void submitSearch(event)}
      >
        <label>
          목적지
          <input
            value={query}
            disabled={busy}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          이동 방식
          <select
            value={profile}
            disabled={busy}
            onChange={(event) => {
              setProfile(event.target.value as RouteProfile);
            }}
          >
            {PROFILE_LABELS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "검색 중" : "검색"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {results.length > 0 && (
        <div className="route-results" aria-label="검색 결과">
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
