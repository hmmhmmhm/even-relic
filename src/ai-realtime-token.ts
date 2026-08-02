import { openAiKeyHeaders } from "./openai-key";
import { isRealtimeTokenResponse } from "./ai-realtime-transport";

const TOKEN_URL = "/api/realtime-token";

export async function requestRealtimeClientSecret(options: {
  readonly fetchImpl: typeof fetch;
  readonly key: string;
  readonly signal: AbortSignal;
}): Promise<string> {
  const response = await options.fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: openAiKeyHeaders(options.key),
    signal: options.signal,
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Could not create Realtime session");
  }
  if (!response.ok || !isRealtimeTokenResponse(data)) {
    throw new Error("Could not create Realtime session");
  }
  return data.value;
}
