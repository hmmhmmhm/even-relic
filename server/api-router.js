import { jsonResponse } from "./http.js";
import { handleNewsRequest } from "./news.js";

export async function handleApiRequest(request, env, dependencies = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (url.pathname === "/api/news" && request.method === "GET") {
    return handleNewsRequest(request, env, dependencies);
  }

  return jsonResponse(
    {
      error: {
        code: "API_NOT_FOUND",
        message: "Unknown RELIC API route",
      },
    },
    { status: 404 },
  );
}
