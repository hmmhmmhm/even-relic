import { jsonResponse } from "./http.js";
import { handleMapRequest } from "./map.js";
import { handleNewsRequest } from "./news.js";
import {
  handleGeocodeRequest,
  handleRouteRequest,
  handleRoutingKeyTest,
  handleRoutingStatus,
} from "./route.js";
import { handleRealtimeTokenRequest } from "./realtime.js";

export async function handleApiRequest(request, env, dependencies = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (url.pathname === "/api/news" && request.method === "GET") {
    return handleNewsRequest(request, env, dependencies);
  }
  if (url.pathname === "/api/map" && request.method === "GET") {
    return handleMapRequest(request, env, dependencies);
  }
  if (url.pathname === "/api/routing-status" && request.method === "GET") {
    return handleRoutingStatus(request, env);
  }
  if (
    url.pathname === "/api/routing-key-test"
    && request.method === "POST"
  ) {
    return handleRoutingKeyTest(request, env, dependencies);
  }
  if (url.pathname === "/api/geocode" && request.method === "GET") {
    return handleGeocodeRequest(request, env, dependencies);
  }
  if (url.pathname === "/api/route" && request.method === "POST") {
    return handleRouteRequest(request, env, dependencies);
  }
  if (
    url.pathname === "/api/realtime-token"
    && request.method === "POST"
  ) {
    return handleRealtimeTokenRequest(request, env, dependencies);
  }

  return jsonResponse(
    {
      error: {
        code: "API_NOT_FOUND",
        message: "Unknown SANDEVISTAN API route",
      },
    },
    { status: 404 },
  );
}
