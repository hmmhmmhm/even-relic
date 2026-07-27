import { describe, expect, it, vi } from "vitest";
import {
  RoutingError,
  getRoutingStatus,
  requestRoute,
  searchDestinations,
} from "./routing";

const destination = {
  id: "venue.1",
  name: "서울역",
  label: "서울역, 서울특별시",
  coordinate: { latitude: 37.5547, longitude: 126.9707 },
} as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("routing client", () => {
  it("reads a disabled routing status from the same origin", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ enabled: false }));

    await expect(getRoutingStatus(fetchImpl as typeof fetch)).resolves.toEqual({
      enabled: false,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/routing-status",
      expect.objectContaining({
        headers: { accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("normalizes and caps destination search results", async () => {
    const results = Array.from({ length: 7 }, (_, index) => ({
      id: `id-${index}`,
      name: `서울역 ${index}`,
      label: `서울역 ${index}, 서울`,
      coordinate: {
        latitude: 37.55 + index / 10_000,
        longitude: 126.97,
      },
    }));
    const fetchImpl = vi.fn(async () => jsonResponse({ results }));

    await expect(
      searchDestinations(" 서울역 ", fetchImpl as typeof fetch),
    ).resolves.toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/geocode?q=%EC%84%9C%EC%9A%B8%EC%97%AD",
      expect.objectContaining({
        headers: { accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("creates a normalized active route without exposing raw ORS data", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      geometry: [
        [37.5563, 126.922],
        [37.5547, 126.9707],
      ],
      distance: 4380.5,
      duration: 3120.2,
      maneuvers: [{
        instruction: "오른쪽으로 도세요",
        distance: 120.4,
        wayPoints: [0, 1],
      }],
    }));

    await expect(requestRoute({
      start: { latitude: 37.5563, longitude: 126.922 },
      destination,
      profile: "foot-walking",
    }, fetchImpl as typeof fetch)).resolves.toEqual({
      destinationName: "서울역",
      geometry: [
        { latitude: 37.5563, longitude: 126.922 },
        { latitude: 37.5547, longitude: 126.9707 },
      ],
      maneuvers: [{
        instruction: "오른쪽으로 도세요",
        distance: 120.4,
        wayPoints: [0, 1],
      }],
      activeManeuverIndex: 0,
      remainingDistance: 4380.5,
      profile: "foot-walking",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/route",
      expect.objectContaining({
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          start: { latitude: 37.5563, longitude: 126.922 },
          destination: { latitude: 37.5547, longitude: 126.9707 },
          profile: "foot-walking",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("turns ROUTING_DISABLED into a typed routing error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      error: {
        code: "ROUTING_DISABLED",
        message: "Routing is not configured",
      },
    }, 503));

    const error = await searchDestinations(
      "서울역",
      fetchImpl as typeof fetch,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RoutingError);
    expect(error).toMatchObject({
      code: "ROUTING_DISABLED",
      disabled: true,
    });
  });

  it("rejects malformed normalized server responses", async () => {
    const invalidStatus = vi.fn(async () => jsonResponse({ enabled: "yes" }));
    const invalidRoute = vi.fn(async () => jsonResponse({
      geometry: [[91, 126.9]],
      distance: -1,
      duration: 1,
      maneuvers: [],
    }));

    await expect(
      getRoutingStatus(invalidStatus as typeof fetch),
    ).rejects.toThrow("길찾기 상태 응답이 올바르지 않습니다.");
    await expect(requestRoute({
      start: { latitude: 37.5563, longitude: 126.922 },
      destination,
      profile: "foot-walking",
    }, invalidRoute as typeof fetch)).rejects.toThrow(
      "길찾기 응답이 올바르지 않습니다.",
    );
  });
});
