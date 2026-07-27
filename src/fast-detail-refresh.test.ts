import { describe, expect, it } from "vitest";
import { detailRefreshTarget } from "./fast-detail-refresh";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";

function baseState(): LiveDashboardState {
  return {
    ...createInitialLiveDashboardState(),
    location: {
      status: "fresh",
      fetchedAt: 1,
      value: {
        coordinate: { latitude: 37.5563, longitude: 126.922 },
        source: "live",
      },
    },
    weather: {
      status: "fresh",
      fetchedAt: 1,
      value: {
        temperature: 28,
        apparentTemperature: 29,
        humidity: 60,
        windSpeed: 2,
        precipitationProbability: 10,
        weatherCode: 1,
        condition: "맑음",
      },
    },
    news: {
      status: "fresh",
      fetchedAt: 1,
      value: [{
        id: "news",
        title: "기사",
        summary: "RSS 요약",
        publishedAt: 1,
      }],
    },
    map: {
      status: "fresh",
      fetchedAt: 1,
      value: {
        roads: [],
        labels: [],
        attribution: "© OSM CONTRIBUTORS",
        cell: "37.5563,126.9220",
      },
    },
    route: {
      status: "fresh",
      fetchedAt: 1,
      value: {
        destinationName: "홍대입구역",
        geometry: [
          { latitude: 37.5563, longitude: 126.922 },
          { latitude: 37.557, longitude: 126.923 },
        ],
        maneuvers: [{
          instruction: "우회전",
          distance: 120,
          wayPoints: [0, 1],
        }],
        activeManeuverIndex: 0,
        remainingDistance: 800,
        profile: "foot-walking",
      },
    },
  };
}

function withState(
  state: LiveDashboardState,
  patch: Partial<LiveDashboardState>,
): LiveDashboardState {
  return { ...state, ...patch };
}

describe("detailRefreshTarget", () => {
  it("keeps dashboard partial refresh targets unchanged", () => {
    const before = baseState();
    const after = withState(before, {
      weather: { ...before.weather, fetchedAt: 2 },
    });

    expect(detailRefreshTarget("dashboard", before, after, "right"))
      .toBe("right");
  });

  it("refreshes a map for map, position, or route-shape changes only", () => {
    const before = baseState();
    const moved = withState(before, {
      location: {
        ...before.location,
        value: {
          ...before.location.value!,
          coordinate: { latitude: 37.557, longitude: 126.923 },
        },
      },
    });
    const weather = withState(before, {
      weather: {
        ...before.weather,
        value: { ...before.weather.value!, temperature: 29 },
      },
    });

    expect(detailRefreshTarget("map", before, moved, "left")).toBe("all");
    expect(detailRefreshTarget("map", before, weather, "right"))
      .toBeUndefined();
  });

  it("refreshes news only when visible RSS fields change", () => {
    const before = baseState();
    const newsChanged = withState(before, {
      news: {
        ...before.news,
        value: [{ ...before.news.value![0], summary: "새 요약" }],
      },
    });
    const routeChanged = withState(before, {
      route: {
        ...before.route,
        value: { ...before.route.value!, remainingDistance: 799 },
      },
    });

    expect(detailRefreshTarget("news", before, newsChanged, "right"))
      .toBe("all");
    expect(detailRefreshTarget("news", before, routeChanged, "all"))
      .toBeUndefined();
  });

  it("refreshes TODO only when an item changes", () => {
    const before = baseState();
    const todosChanged = withState(before, {
      todos: {
        ...before.todos,
        value: before.todos.value!.map((item, index) =>
          index === 0 ? { ...item, completed: true } : item
        ),
      },
    });

    expect(detailRefreshTarget("todo", before, todosChanged, "right"))
      .toBe("all");
    expect(detailRefreshTarget("todo", before, before, "right"))
      .toBeUndefined();
  });

  it("refreshes navigation display fields but ignores route geometry alone", () => {
    const before = baseState();
    const routeChanged = withState(before, {
      route: {
        ...before.route,
        value: { ...before.route.value!, remainingDistance: 799 },
      },
    });
    const geometryOnly = withState(before, {
      route: {
        ...before.route,
        value: {
          ...before.route.value!,
          geometry: [
            ...before.route.value!.geometry,
            { latitude: 37.558, longitude: 126.924 },
          ],
        },
      },
    });

    expect(detailRefreshTarget(
      "navigation",
      before,
      routeChanged,
      "right",
    )).toBe("all");
    expect(detailRefreshTarget(
      "navigation",
      before,
      geometryOnly,
      "right",
    )).toBeUndefined();
  });

  it("does not refresh navigation within the same displayed distance bucket", () => {
    const before = baseState();
    const longRoute = withState(before, {
      route: {
        ...before.route,
        value: { ...before.route.value!, remainingDistance: 1_241 },
      },
    });
    const sameBucket = withState(longRoute, {
      route: {
        ...longRoute.route,
        value: { ...longRoute.route.value!, remainingDistance: 1_249 },
      },
    });

    expect(detailRefreshTarget(
      "navigation",
      longRoute,
      sameBucket,
      "right",
    )).toBeUndefined();
  });
});
