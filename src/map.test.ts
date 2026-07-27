import { describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "./live-cache";
import type { Coordinate, MapValue } from "./live-state";
import {
  clientMapCell,
  MAP_MAX_AGE_MS,
  parseMapResponse,
  projectCoordinate,
  resolveMap,
} from "./map";

const NOW = Date.parse("2026-07-27T14:20:00Z");
const CENTER: Coordinate = {
  latitude: 37.5563,
  longitude: 126.922,
};
const VALUE: MapValue = {
  cell: "37.555,126.920",
  attribution: "© OSM CONTRIBUTORS",
  roads: [
    {
      kind: "major",
      points: [
        { latitude: 37.55, longitude: 126.91 },
        { latitude: 37.56, longitude: 126.92 },
      ],
    },
  ],
};

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];

  async getLocalStorage(key: string): Promise<string> {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    this.values.set(key, value);
    return true;
  }
}

function mapResponse(
  cell = "37.555,126.920",
  roads: unknown = [
    {
      kind: "major",
      points: [[37.55, 126.91], [37.56, 126.92]],
    },
  ],
): Response {
  return new Response(JSON.stringify({
    cell,
    attribution: "© OSM CONTRIBUTORS",
    roads,
  }));
}

function setCache(
  storage: TestStorage,
  value: MapValue,
  fetchedAt: number,
) {
  storage.values.set(
    "relic:map:v1",
    JSON.stringify({ value, fetchedAt, cell: value.cell }),
  );
}

describe("map response and projection helpers", () => {
  it("parses normalized server roads into coordinate objects", () => {
    expect(parseMapResponse({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: [
        {
          kind: "major",
          points: [[37.55, 126.91], [37.56, 126.92]],
        },
      ],
    }).roads[0]).toEqual({
      kind: "major",
      points: [
        { latitude: 37.55, longitude: 126.91 },
        { latitude: 37.56, longitude: 126.92 },
      ],
    });
  });

  it("rejects malformed, excessive, or untrusted normalized responses", () => {
    expect(() => parseMapResponse({
      cell: "37.555,126.920",
      attribution: "someone else",
      roads: [],
    })).toThrow();
    expect(() => parseMapResponse({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: [{ kind: "minor", points: [[91, 127], [37, 127]] }],
    })).toThrow();
    expect(() => parseMapResponse({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: Array.from({ length: 181 }, () => ({
        kind: "minor",
        points: [[37, 127], [37.1, 127.1]],
      })),
    })).toThrow();
  });

  it("projects center, north, and east in the expected directions", () => {
    expect(projectCoordinate(CENTER, CENTER, 650)).toEqual({
      x: 144,
      y: 144,
    });
    expect(projectCoordinate({
      latitude: CENTER.latitude + 0.001,
      longitude: CENTER.longitude,
    }, CENTER, 650).y).toBeLessThan(144);
    expect(projectCoordinate({
      latitude: CENTER.latitude,
      longitude: CENTER.longitude + 0.001,
    }, CENTER, 650).x).toBeGreaterThan(144);
  });

  it("uses the same deterministic cell contract as the server", () => {
    expect(clientMapCell(CENTER)).toBe("37.555,126.920");
    expect(clientMapCell({
      latitude: 37.557,
      longitude: 126.924,
    })).toBe("37.555,126.920");
    expect(clientMapCell({
      latitude: 37.56,
      longitude: 126.925,
    })).toBe("37.560,126.925");
  });
});

describe("resolveMap", () => {
  it("reuses a fresh map in one cell and requests again after crossing cells", async () => {
    const storage = new TestStorage();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.test");
      return mapResponse(clientMapCell({
        latitude: Number(url.searchParams.get("lat")),
        longitude: Number(url.searchParams.get("lng")),
      }));
    }) as unknown as typeof fetch;

    await resolveMap(storage, CENTER, fetchImpl, NOW);
    await resolveMap(storage, {
      latitude: 37.557,
      longitude: 126.924,
    }, fetchImpl, NOW + 1);
    await resolveMap(storage, {
      latitude: 37.56,
      longitude: 126.925,
    }, fetchImpl, NOW + 2);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetchImpl).mock.calls[0][0])).toBe(
      "/api/map?lat=37.5563&lng=126.922",
    );
  });

  it("shows a stale matching map before refresh and keeps it on failure", async () => {
    const storage = new TestStorage();
    const fetchedAt = NOW - MAP_MAX_AGE_MS - 1;
    setCache(storage, VALUE, fetchedAt);
    const cached = vi.fn();

    const result = await resolveMap(
      storage,
      CENTER,
      vi.fn(async () => {
        throw new Error("network failed");
      }) as unknown as typeof fetch,
      NOW,
      cached,
    );

    expect(cached).toHaveBeenCalledWith({
      status: "stale",
      value: VALUE,
      fetchedAt,
    });
    expect(result).toEqual({
      status: "stale",
      value: VALUE,
      fetchedAt,
    });
  });

  it("does not use geometry from a different cell", async () => {
    const storage = new TestStorage();
    setCache(storage, VALUE, NOW);

    await expect(resolveMap(
      storage,
      { latitude: 37.57, longitude: 126.94 },
      vi.fn(async () => new Response("", { status: 502 })) as unknown as typeof fetch,
      NOW,
    )).resolves.toEqual({ status: "unavailable" });
  });

  it("persists a bounded fresh response and rejects a mismatched server cell", async () => {
    const storage = new TestStorage();
    const result = await resolveMap(
      storage,
      CENTER,
      vi.fn(async () => mapResponse()) as unknown as typeof fetch,
      NOW,
    );

    expect(result).toEqual({
      status: "fresh",
      value: VALUE,
      fetchedAt: NOW,
    });
    expect(storage.writes).toEqual([[
      "relic:map:v1",
      JSON.stringify({
        value: VALUE,
        fetchedAt: NOW,
        cell: VALUE.cell,
      }),
    ]]);

    await expect(resolveMap(
      new TestStorage(),
      CENTER,
      vi.fn(async () => mapResponse("37.560,126.925")) as unknown as typeof fetch,
      NOW,
    )).resolves.toEqual({ status: "unavailable" });
  });
});
