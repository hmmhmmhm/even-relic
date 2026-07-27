import { jsonResponse } from "./http.js";

export async function handleApiRequest(request, _env, _dependencies = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

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
