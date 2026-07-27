import assert from "node:assert/strict";
import test from "node:test";
import { handleApiRequest } from "../server/api-router.js";
import {
  buildOverpassQuery,
  handleMapRequest,
  mapCell,
} from "../server/map.js";

function overpassResponse(elements = []) {
  return new Response(JSON.stringify({ elements }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("builds a bounded road-only Overpass query and normalizes geometry", async () => {
  const calls = [];
  const response = await handleApiRequest(
    new Request("https://example.test/api/map?lat=37.5563&lng=126.922"),
    {},
    {
      cache: null,
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return overpassResponse([
          {
            type: "way",
            tags: { highway: "primary" },
            geometry: [
              { lat: 37.55, lon: 126.91 },
              { lat: 37.56, lon: 126.92 },
            ],
          },
          {
            type: "way",
            tags: { highway: "residential" },
            geometry: [
              { lat: 37.56, lon: 126.92 },
              { lat: 37.57, lon: 126.93 },
            ],
          },
        ]);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    cell: "37.555,126.920",
    attribution: "© OSM CONTRIBUTORS",
    roads: [
      {
        kind: "major",
        points: [[37.55, 126.91], [37.56, 126.92]],
      },
      {
        kind: "minor",
        points: [[37.56, 126.92], [37.57, 126.93]],
      },
    ],
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://overpass-api.de/api/interpreter");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.redirect, "error");
  assert.deepEqual(calls[0].options.headers, {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent": "RELIC-G2-Personal-Prototype/0.1",
  });
  const query = calls[0].options.body.get("data");
  assert.match(query, /way\["highway"\]\(around:650,37\.5563,126\.922\)/);
  assert.match(query, /out geom;$/);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=3600, s-maxage=86400",
  );
});

test("validates coordinates before contacting Overpass", async () => {
  for (const query of [
    "lat=91&lng=126.922",
    "lat=x&lng=126.922",
    "lat=&lng=126.922",
    "lat=37.5&lng=181",
  ]) {
    let calls = 0;
    const response = await handleMapRequest(
      new Request(`https://example.test/api/map?${query}`),
      {},
      {
        fetchImpl: async () => {
          calls += 1;
          return overpassResponse();
        },
      },
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_COORDINATE");
    assert.equal(calls, 0);
  }
});

test("leaves non-GET map requests to the API 404", async () => {
  const response = await handleApiRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127", {
      method: "POST",
    }),
    {},
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "API_NOT_FOUND");
});

test("prefers major roads and enforces way and point limits", async () => {
  const minor = Array.from({ length: 180 }, (_, index) => ({
    type: "way",
    tags: { highway: "service" },
    geometry: [
      { lat: 37 + index / 10_000, lon: 127 },
      { lat: 37 + index / 10_000, lon: 127.001 },
    ],
  }));
  const major = {
    type: "way",
    tags: { highway: "secondary" },
    geometry: Array.from({ length: 3_900 }, (_, index) => ({
      lat: 37 + index / 1_000_000,
      lon: 127,
    })),
  };
  const response = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      fetchImpl: async () => overpassResponse([...minor, major]),
    },
  );
  const body = await response.json();
  assert.equal(body.roads[0].kind, "major");
  assert.ok(body.roads.length <= 180);
  assert.ok(
    body.roads.reduce((sum, road) => sum + road.points.length, 0) <= 4_000,
  );
});

test("caches a normalized response by rounded location cell", async () => {
  const entries = new Map();
  const cacheKeys = [];
  const cache = {
    async match(request) {
      cacheKeys.push(request.url);
      return entries.get(request.url)?.clone();
    },
    async put(request, response) {
      entries.set(request.url, response.clone());
    },
  };
  let calls = 0;
  const dependencies = {
    cache,
    fetchImpl: async () => {
      calls += 1;
      return overpassResponse();
    },
  };

  const first = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5563&lng=126.922"),
    {},
    dependencies,
  );
  const second = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.557&lng=126.924"),
    {},
    dependencies,
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);
  assert.equal(new Set(cacheKeys).size, 1);
});

test("maps upstream, size, and timeout failures to stable errors", async () => {
  const upstream = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      fetchImpl: async () => new Response("bad", { status: 503 }),
    },
  );
  assert.equal(upstream.status, 502);
  assert.equal((await upstream.json()).error.code, "MAP_UPSTREAM_ERROR");

  const tooLarge = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      fetchImpl: async () => new Response("x".repeat(1_000_001)),
    },
  );
  assert.equal(tooLarge.status, 502);
  assert.equal((await tooLarge.json()).error.code, "MAP_TOO_LARGE");

  const cleared = [];
  const timeout = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      setTimeoutImpl: (callback, milliseconds) => {
        assert.equal(milliseconds, 8_000);
        callback();
        return 77;
      },
      clearTimeoutImpl: (timer) => cleared.push(timer),
      fetchImpl: async (_url, { signal }) => {
        assert.equal(signal.aborted, true);
        throw new DOMException("Aborted", "AbortError");
      },
    },
  );
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).error.code, "MAP_TIMEOUT");
  assert.deepEqual(cleared, [77]);
});

test("cell and query helpers are deterministic", () => {
  assert.equal(mapCell(37.5563, 126.922), "37.555,126.920");
  assert.equal(
    buildOverpassQuery(37.5563, 126.922),
    '[out:json][timeout:8];way["highway"](around:650,37.5563,126.922);out geom;',
  );
});
