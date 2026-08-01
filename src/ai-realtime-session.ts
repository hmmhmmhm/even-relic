import {
  AudioInputSource,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { openAiKeyHeaders } from "./openai-key";
import {
  createAudioAppendEvent,
  createRealtimeProtocolState,
  createRealtimeSessionUpdate,
  resamplePcm16Le16To24,
  reduceRealtimeServerEvent,
  type AiRealtimeProtocolState,
} from "./ai-realtime-protocol";
import type { PhoneLocale } from "./phone-types";

type AudioBridge = {
  audioControl(
    isOpen: boolean,
    source?: AudioInputSource,
  ): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

type RealtimeSocket = {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(value: string): void;
  close(): void;
};

type TokenResponse = {
  readonly value: string;
  readonly expiresAt: number;
  readonly model: string;
};

export type AiRealtimeSession = {
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<AiRealtimeProtocolState>;
  getState(): AiRealtimeProtocolState;
};

type SessionOptions = {
  readonly bridge: AudioBridge;
  readonly key: string;
  readonly locale: PhoneLocale;
  readonly fetchImpl?: typeof fetch;
  readonly createSocket?: (
    url: string,
    protocols: string[],
  ) => RealtimeSocket;
  readonly onState?: (
    state: AiRealtimeProtocolState,
    eventType?: string,
  ) => void;
};

const REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime";
const TOKEN_URL = "/api/realtime-token";
const SOCKET_OPEN = 1;
const MAX_PCM_CHUNK_BYTES = 65_536;

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.value === "string"
    && item.value.length >= 10
    && item.value.length <= 4_096
    && typeof item.expiresAt === "number"
    && Number.isFinite(item.expiresAt)
    && item.model === "gpt-realtime";
}

function defaultSocket(url: string, protocols: string[]): RealtimeSocket {
  return new WebSocket(url, protocols) as unknown as RealtimeSocket;
}

export function createAiRealtimeSession(
  options: SessionOptions,
): AiRealtimeSession {
  const fetchImpl = options.fetchImpl ?? fetch;
  const createSocket = options.createSocket ?? defaultSocket;
  let state = createRealtimeProtocolState();
  let socket: RealtimeSocket | undefined;
  let unsubscribeAudio: (() => void) | undefined;
  let microphoneOpen = false;
  let microphoneActivation: Promise<boolean> | undefined;
  let starting = false;
  let closing = false;
  let cleanupPromise: Promise<boolean> | undefined;
  let lifecycle = 0;
  let startAbortController: AbortController | undefined;

  const publish = (next: AiRealtimeProtocolState, eventType?: string) => {
    state = next;
    options.onState?.(state, eventType);
  };

  const send = (event: unknown) => {
    if (socket?.readyState !== SOCKET_OPEN) return;
    socket.send(JSON.stringify(event));
  };

  const closeMicrophone = async (attempts = 2): Promise<boolean> => {
    if (!microphoneOpen) return true;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const closed = await options.bridge.audioControl(false)
        .catch(() => false);
      if (closed) {
        microphoneOpen = false;
        return true;
      }
    }
    return false;
  };

  const cleanup = (finalPhase: "idle" | "error" = "idle") => {
    lifecycle += 1;
    cleanupPromise ??= (async () => {
      closing = true;
      startAbortController?.abort();
      startAbortController = undefined;
      const activation = microphoneActivation;
      if (activation) {
        const opened = await activation.catch(() => false);
        if (microphoneActivation === activation) {
          microphoneActivation = undefined;
        }
        if (opened) microphoneOpen = true;
      }
      const microphoneClosed = await closeMicrophone();
      unsubscribeAudio?.();
      unsubscribeAudio = undefined;
      const activeSocket = socket;
      socket = undefined;
      activeSocket?.close();
      starting = false;
      if (!microphoneClosed) {
        publish({
          ...state,
          phase: "error",
          error: "G2 microphone could not close",
        });
      } else if (finalPhase === "idle") {
        publish({ ...state, phase: "idle" });
      }
      return microphoneClosed;
    })().finally(() => {
      closing = false;
      cleanupPromise = undefined;
    });
    return cleanupPromise;
  };

  const activateMicrophone = () => {
    const activation = Promise.resolve().then(() => (
      options.bridge.audioControl(true, AudioInputSource.Glasses)
    ));
    microphoneActivation = activation;
    return activation.finally(() => {
      if (microphoneActivation === activation) {
        microphoneActivation = undefined;
      }
    });
  };

  const subscribeAudio = () => {
    unsubscribeAudio = options.bridge.onEvenHubEvent((event) => {
      const audio = event.audioEvent;
      if (
        !microphoneOpen
        || socket?.readyState !== SOCKET_OPEN
        || !audio
        || audio.source !== AudioInputSource.Glasses
        || audio.audioPcm.length === 0
        || audio.audioPcm.length > MAX_PCM_CHUNK_BYTES
      ) {
        return;
      }
      const resampled = resamplePcm16Le16To24(audio.audioPcm);
      if (resampled.length > 0) send(createAudioAppendEvent(resampled));
    });
  };

  const openSocket = (secret: string): Promise<void> => new Promise(
    (resolve, reject) => {
      const nextSocket = createSocket(REALTIME_URL, [
        "realtime",
        `openai-insecure-api-key.${secret}`,
      ]);
      socket = nextSocket;
      let settled = false;
      const timeout = globalThis.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Realtime connection timed out"));
      }, 10_000);
      nextSocket.onopen = () => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeout);
        resolve();
      };
      nextSocket.onerror = () => {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timeout);
          reject(new Error("Realtime connection failed"));
          return;
        }
        if (closing) return;
        publish({
          ...state,
          phase: "error",
          error: "Realtime connection failed",
        });
        void cleanup("error");
      };
      nextSocket.onclose = () => {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timeout);
          reject(new Error("Realtime connection closed"));
          return;
        }
        if (closing) return;
        publish({
          ...state,
          phase: "error",
          error: "Realtime connection closed",
        });
        void cleanup("error");
      };
      nextSocket.onmessage = (event) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        const eventType = typeof parsed === "object"
          && parsed !== null
          && "type" in parsed
          && typeof parsed.type === "string"
          ? parsed.type
          : undefined;
        const next = reduceRealtimeServerEvent(state, parsed as never);
        if (next !== state) publish(next, eventType);
        if (next.phase === "error") void cleanup("error");
      };
    },
  );

  return {
    async start() {
      if (starting || socket) return;
      starting = true;
      const operation = ++lifecycle;
      const abortController = new AbortController();
      startAbortController = abortController;
      publish({ ...createRealtimeProtocolState(), phase: "connecting" });
      try {
        const response = await fetchImpl(TOKEN_URL, {
          method: "POST",
          headers: openAiKeyHeaders(options.key),
          signal: abortController.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok || !isTokenResponse(data)) {
          throw new Error("Could not create Realtime session");
        }
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        await openSocket(data.value);
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        send(createRealtimeSessionUpdate(options.locale));
        subscribeAudio();
        const opened = await activateMicrophone();
        microphoneOpen = opened;
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        if (!opened) throw new Error("G2 microphone unavailable");
        publish({ ...state, phase: "listening", error: undefined });
      } catch (error) {
        if (operation !== lifecycle) {
          await cleanup(state.phase === "error" ? "error" : "idle");
          throw new Error("Realtime start cancelled");
        }
        publish({
          ...state,
          phase: "error",
          error: error instanceof Error
            ? error.message.slice(0, 160)
            : "Realtime session failed",
        });
        await cleanup("error");
        throw error;
      } finally {
        if (startAbortController === abortController) {
          startAbortController = undefined;
        }
        starting = false;
      }
    },
    async pause() {
      if (!microphoneOpen) return;
      const closed = await closeMicrophone(1);
      if (!closed) {
        publish({
          ...state,
          phase: "error",
          error: "G2 microphone could not close",
        });
        await cleanup("error");
        throw new Error("G2 microphone could not close");
      }
      publish({ ...state, phase: "paused" });
    },
    async resume() {
      if (microphoneOpen || !socket) return;
      const operation = lifecycle;
      const opened = await activateMicrophone();
      microphoneOpen = opened;
      if (operation !== lifecycle) {
        await cleanup(state.phase === "error" ? "error" : "idle");
        throw new Error("Realtime resume cancelled");
      }
      if (!opened) throw new Error("G2 microphone unavailable");
      publish({ ...state, phase: "listening", error: undefined });
    },
    async stop() {
      const microphoneClosed = await cleanup();
      if (!microphoneClosed) {
        throw new Error("G2 microphone could not close");
      }
      return state;
    },
    getState() {
      return state;
    },
  };
}
