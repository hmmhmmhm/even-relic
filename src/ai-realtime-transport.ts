export type RealtimeSocket = {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(value: string): void;
  close(): void;
};

export type RealtimeTokenResponse = {
  readonly value: string;
  readonly expiresAt: number;
  readonly model: string;
};

export function isRealtimeTokenResponse(
  value: unknown,
): value is RealtimeTokenResponse {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.value === "string"
    && item.value.length >= 10
    && item.value.length <= 4_096
    && typeof item.expiresAt === "number"
    && Number.isFinite(item.expiresAt)
    && item.model === "gpt-realtime";
}

export function createDefaultRealtimeSocket(
  url: string,
  protocols: string[],
): RealtimeSocket {
  return new WebSocket(url, protocols) as unknown as RealtimeSocket;
}
