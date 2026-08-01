import {
  createTimeout,
  jsonResponse,
  readLimitedBytes,
} from "./http.js";

export const OPENAI_KEY_HEADER = "x-sandevistan-openai-key";
export const OPENAI_REALTIME_MODEL = "gpt-realtime";
const OPENAI_TOKEN_URL = "https://api.openai.com/v1/realtime/client_secrets";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const TOKEN_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_BYTES = 16_384;

function validOpenAiKey(value) {
  return typeof value === "string"
    && value.startsWith("sk-")
    && value.length >= 20
    && value.length <= 4_096
    && !CONTROL_CHARACTERS.test(value);
}

function errorResponse(code, message, status) {
  return jsonResponse(
    { error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function handleRealtimeTokenRequest(
  request,
  _env,
  dependencies = {},
) {
  const key = request.headers.get(OPENAI_KEY_HEADER)?.trim();
  if (!key) {
    return errorResponse(
      "OPENAI_KEY_REQUIRED",
      "OpenAI key required",
      401,
    );
  }
  if (!validOpenAiKey(key)) {
    return errorResponse(
      "OPENAI_KEY_INVALID",
      "OpenAI key is invalid",
      400,
    );
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeout = createTimeout(TOKEN_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetchImpl(OPENAI_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: { type: "realtime", model: OPENAI_REALTIME_MODEL },
      }),
      signal: timeout.signal,
    });
  } catch (error) {
    return errorResponse(
      error?.name === "AbortError"
        ? "OPENAI_TOKEN_TIMEOUT"
        : "OPENAI_TOKEN_UNAVAILABLE",
      error?.name === "AbortError"
        ? "OpenAI Realtime session timed out"
        : "OpenAI Realtime session is unavailable",
      error?.name === "AbortError" ? 504 : 502,
    );
  } finally {
    timeout.dispose();
  }

  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => undefined);
    return errorResponse(
      "OPENAI_TOKEN_REJECTED",
      "OpenAI rejected the Realtime session",
      502,
    );
  }

  let data;
  try {
    const bytes = await readLimitedBytes(upstream, MAX_UPSTREAM_BYTES);
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return errorResponse(
      "OPENAI_TOKEN_INVALID",
      "OpenAI returned an invalid Realtime session",
      502,
    );
  }
  if (
    typeof data?.value !== "string"
    || data.value.length < 10
    || data.value.length > 4_096
    || !Number.isFinite(data.expires_at)
  ) {
    return errorResponse(
      "OPENAI_TOKEN_INVALID",
      "OpenAI returned an invalid Realtime session",
      502,
    );
  }
  return jsonResponse(
    {
      value: data.value,
      expiresAt: data.expires_at,
      model: OPENAI_REALTIME_MODEL,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
