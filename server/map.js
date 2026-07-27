import {
  createTimeout,
  jsonResponse,
  readLimitedBytes,
} from "./http.js";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const MAP_RADIUS_METERS = 650;

const MAX_BYTES = 1_000_000;
const MAX_ROADS = 180;
const MAX_POINTS = 4_000;
const TIMEOUT_MS = 8_000;
const MAJOR_HIGHWAYS = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
]);

function mapError(code, message, status) {
  return jsonResponse({ error: { code, message } }, { status });
}

function coordinateParameter(value, minimum, maximum) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }
  return parsed;
}

export function mapCell(latitude, longitude) {
  const lat = Math.floor(latitude / 0.005) * 0.005;
  const lng = Math.floor(longitude / 0.005) * 0.005;
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function buildOverpassQuery(latitude, longitude) {
  return (
    `[out:json][timeout:8];way["highway"]` +
    `(around:${MAP_RADIUS_METERS},${latitude},${longitude});out geom;`
  );
}

function normalizedRoad(element) {
  const highway = element?.tags?.highway;
  if (element?.type !== "way" || typeof highway !== "string") return null;
  const points = Array.isArray(element.geometry)
    ? element.geometry.flatMap((point) => {
      const latitude = Number(point?.lat);
      const longitude = Number(point?.lon);
      return Number.isFinite(latitude) && Number.isFinite(longitude)
        ? [[latitude, longitude]]
        : [];
    })
    : [];
  if (points.length < 2) return null;
  return {
    kind: MAJOR_HIGHWAYS.has(highway) ? "major" : "minor",
    points,
  };
}

function normalizeMapPayload(payload, cell) {
  const candidates = Array.isArray(payload?.elements)
    ? payload.elements.map(normalizedRoad).filter(Boolean)
    : [];
  candidates.sort((left, right) => {
    if (left.kind === right.kind) return 0;
    return left.kind === "major" ? -1 : 1;
  });

  const roads = [];
  let pointCount = 0;
  for (const candidate of candidates) {
    if (roads.length >= MAX_ROADS) break;
    const remaining = MAX_POINTS - pointCount;
    if (remaining < 2) break;
    const points = candidate.points.slice(0, remaining);
    if (points.length < 2) continue;
    roads.push({ kind: candidate.kind, points });
    pointCount += points.length;
  }
  return {
    cell,
    attribution: "© OSM CONTRIBUTORS",
    roads,
  };
}

function cacheRequest(cell) {
  return new Request(
    `https://relic-map-cache.invalid/roads?cell=${encodeURIComponent(cell)}`,
  );
}

export async function handleMapRequest(
  request,
  _env,
  {
    fetchImpl = fetch,
    cache = globalThis.caches?.default,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  const url = new URL(request.url);
  const latitude = coordinateParameter(
    url.searchParams.get("lat"),
    -90,
    90,
  );
  const longitude = coordinateParameter(
    url.searchParams.get("lng"),
    -180,
    180,
  );
  if (latitude === null || longitude === null) {
    return mapError(
      "INVALID_COORDINATE",
      "Latitude or longitude is invalid",
      400,
    );
  }

  const cell = mapCell(latitude, longitude);
  const key = cacheRequest(cell);
  if (cache) {
    try {
      const cached = await cache.match(key);
      if (cached) return cached;
    } catch {
      // A cache outage must not prevent a live map response.
    }
  }

  const timeout = createTimeout(
    TIMEOUT_MS,
    setTimeoutImpl,
    clearTimeoutImpl,
  );
  try {
    const upstream = await fetchImpl(OVERPASS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "RELIC-G2-Personal-Prototype/0.1",
      },
      body: new URLSearchParams({
        data: buildOverpassQuery(latitude, longitude),
      }),
      redirect: "error",
      signal: timeout.signal,
    });
    if (!upstream.ok) {
      return mapError(
        "MAP_UPSTREAM_ERROR",
        "Map upstream request failed",
        502,
      );
    }

    const bytes = await readLimitedBytes(upstream, MAX_BYTES);
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    const response = jsonResponse(normalizeMapPayload(payload, cell), {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    });
    if (cache) {
      try {
        await cache.put(key, response.clone());
      } catch {
        // The current response remains usable when cache persistence fails.
      }
    }
    return response;
  } catch (error) {
    if (timeout.signal.aborted || error?.name === "AbortError") {
      return mapError("MAP_TIMEOUT", "Map request timed out", 504);
    }
    if (error instanceof Error && error.message === "RESPONSE_TOO_LARGE") {
      return mapError("MAP_TOO_LARGE", "Map response is too large", 502);
    }
    return mapError(
      "MAP_UPSTREAM_ERROR",
      "Map upstream request failed",
      502,
    );
  } finally {
    timeout.dispose();
  }
}
