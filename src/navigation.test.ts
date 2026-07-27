import { describe, expect, it } from "vitest";
import type { RouteValue } from "./live-state";
import {
  distanceBucket,
  distanceToRouteMeters,
  haversineMeters,
  routeProgress,
  selectActiveManeuver,
} from "./navigation";

const route: RouteValue = {
  destinationName: "서울역",
  geometry: [
    { latitude: 37.5563, longitude: 126.922 },
    { latitude: 37.5563, longitude: 126.923 },
    { latitude: 37.5563, longitude: 126.924 },
  ],
  maneuvers: [
    {
      instruction: "직진",
      distance: 88,
      wayPoints: [0, 1],
    },
    {
      instruction: "우회전",
      distance: 88,
      wayPoints: [1, 2],
    },
  ],
  activeManeuverIndex: 0,
  remainingDistance: 176,
  profile: "foot-walking",
};

describe("navigation geometry", () => {
  it("computes stable point and route distances", () => {
    const point = { latitude: 37.5563, longitude: 126.922 };
    expect(haversineMeters(point, point)).toBe(0);
    expect(distanceToRouteMeters(
      { latitude: 37.55631, longitude: 126.9225 },
      route.geometry,
    )).toBeLessThan(3);
    expect(distanceToRouteMeters(
      { latitude: 37.5573, longitude: 126.9225 },
      route.geometry,
    )).toBeGreaterThan(100);
  });

  it("uses readable ten, fifty, and hundred meter buckets", () => {
    expect(distanceBucket(187)).toBe(180);
    expect(distanceBucket(999)).toBe(950);
    expect(distanceBucket(1240)).toBe(1200);
    expect(distanceBucket(-1)).toBe(0);
  });

  it("selects the maneuver nearest to the current route segment", () => {
    expect(selectActiveManeuver(
      route,
      { latitude: 37.5563, longitude: 126.9224 },
    )).toBe(0);
    expect(selectActiveManeuver(
      route,
      { latitude: 37.5563, longitude: 126.9236 },
    )).toBe(1);
  });

  it("updates the maneuver and remaining route distance", () => {
    const progress = routeProgress(
      route,
      { latitude: 37.5563, longitude: 126.9235 },
    );

    expect(progress.activeManeuverIndex).toBe(1);
    expect(progress.remainingDistance).toBeGreaterThan(40);
    expect(progress.remainingDistance).toBeLessThan(50);
  });
});
