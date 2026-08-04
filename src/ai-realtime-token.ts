const TOKEN_URL = "https://api.openai.com/v1/realtime/client_secrets";

export async function requestRealtimeClientSecret(options: {
  readonly fetchImpl: typeof fetch;
  readonly key: string;
  readonly signal: AbortSignal;
  readonly purpose?: "assistant" | "transcription";
  readonly transcriptionModel?: "gpt-live-transcribe" | "gpt-transcribe";
}): Promise<string> {
  const response = await options.fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: options.purpose === "transcription"
        ? { type: "transcription", audio: { input: { transcription: {
            model: options.transcriptionModel ?? "gpt-live-transcribe",
          } } } }
        : { type: "realtime", model: "gpt-realtime" },
    }),
    signal: options.signal,
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Could not create Realtime session");
  }
  const value = typeof data === "object"
      && data !== null
      && "value" in data
      && typeof data.value === "string"
    ? data.value
    : undefined;
  if (!response.ok || !value || value.length < 10 || value.length > 4_096) {
    throw new Error("Could not create Realtime session");
  }
  return value;
}
