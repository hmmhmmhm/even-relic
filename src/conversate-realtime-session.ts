import { AudioInputSource, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createAudioAppendEvent, resamplePcm16Le16To24 } from "./ai-realtime-audio";
import { requestRealtimeClientSecret } from "./ai-realtime-token";
import {
  createDefaultRealtimeSocket,
  type RealtimeSocket,
} from "./ai-realtime-transport";
import type { PhoneLocale } from "./phone-types";

const REALTIME_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const SOCKET_OPEN = 1;
const MAX_PCM_CHUNK_BYTES = 65_536;

type Bridge = {
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

export type ConversateRealtimeSession = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

export function createConversateRealtimeSession(options: {
  readonly bridge: Bridge;
  readonly key: string;
  readonly locale: PhoneLocale;
  readonly prompt?: string;
  readonly onPartial: (itemId: string, text: string) => void;
  readonly onCompleted: (itemId: string, text: string) => void;
  readonly onError: (message: string) => void;
  readonly fetchImpl?: typeof fetch;
  readonly createSocket?: (url: string, protocols: string[]) => RealtimeSocket;
}): ConversateRealtimeSession {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const socketFactory = options.createSocket ?? createDefaultRealtimeSocket;
  let socket: RealtimeSocket | undefined;
  let unsubscribe: (() => void) | undefined;
  let microphoneOpen = false;
  let closing = false;
  const partials = new Map<string, string>();
  const abort = new AbortController();

  const send = (value: unknown) => {
    if (socket?.readyState === SOCKET_OPEN) socket.send(JSON.stringify(value));
  };

  const closeMicrophone = async () => {
    if (!microphoneOpen) return;
    await options.bridge.audioControl(false).catch(() => false);
    microphoneOpen = false;
  };

  const openSocket = (secret: string) => new Promise<void>((resolve, reject) => {
    const next = socketFactory(REALTIME_URL, [
      "realtime",
      `openai-insecure-api-key.${secret}`,
    ]);
    socket = next;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) reject(new Error("Transcription connection timed out"));
    }, 10_000);
    next.onopen = () => {
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    next.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error("Transcription connection failed"));
      } else if (!closing) options.onError("Transcription connection failed");
    };
    next.onclose = () => {
      if (!settled) reject(new Error("Transcription connection closed"));
      else if (!closing) options.onError("Transcription connection closed");
    };
    next.onmessage = ({ data }) => {
      let event: Record<string, unknown>;
      try { event = JSON.parse(data) as Record<string, unknown>; } catch { return; }
      const itemId = typeof event.item_id === "string" ? event.item_id : "";
      if (!itemId) return;
      if (event.type === "conversation.item.input_audio_transcription.delta") {
        const delta = typeof event.delta === "string" ? event.delta : "";
        const text = `${partials.get(itemId) ?? ""}${delta}`;
        partials.set(itemId, text);
        options.onPartial(itemId, text);
      }
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        const text = typeof event.transcript === "string"
          ? event.transcript.trim()
          : (partials.get(itemId) ?? "").trim();
        partials.delete(itemId);
        if (text) options.onCompleted(itemId, text);
      }
      if (event.type === "error") options.onError("Transcription session error");
    };
  });

  return {
    async start() {
      const secret = await requestRealtimeClientSecret({
        fetchImpl,
        key: options.key,
        signal: abort.signal,
        purpose: "transcription",
      });
      await openSocket(secret);
      send({
        type: "session.update",
        session: {
          type: "transcription",
          audio: { input: {
            format: { type: "audio/pcm", rate: 24_000 },
            transcription: {
              model: "gpt-live-transcribe",
              delay: "low",
              ...(options.prompt ? { prompt: options.prompt } : {}),
            },
            turn_detection: {
              type: "server_vad",
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          } },
        },
      });
      unsubscribe = options.bridge.onEvenHubEvent((event) => {
        const audio = event.audioEvent;
        if (!microphoneOpen || socket?.readyState !== SOCKET_OPEN || !audio
          || audio.source !== AudioInputSource.Glasses || audio.audioPcm.length === 0
          || audio.audioPcm.length > MAX_PCM_CHUNK_BYTES) return;
        const bytes = resamplePcm16Le16To24(audio.audioPcm);
        if (bytes.length) send(createAudioAppendEvent(bytes));
      });
      microphoneOpen = await options.bridge.audioControl(true, AudioInputSource.Glasses);
      if (!microphoneOpen) throw new Error("G2 microphone unavailable");
    },
    async stop() {
      closing = true;
      abort.abort();
      unsubscribe?.();
      unsubscribe = undefined;
      socket?.close();
      socket = undefined;
      await closeMicrophone();
    },
  };
}
