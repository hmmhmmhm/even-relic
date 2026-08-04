import { AudioInputSource, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createAudioAppendEvent, resamplePcm16Le16To24 } from "./ai-realtime-audio";
import { requestRealtimeClientSecret } from "./ai-realtime-token";
import {
  createDefaultRealtimeSocket,
  type RealtimeSocket,
} from "./ai-realtime-transport";
import { logDiagnostic } from "./diagnostic-log";
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
  readonly languages?: readonly string[];
  readonly keywords?: readonly string[];
  readonly onPartial: (itemId: string, text: string) => void;
  readonly onCompleted: (itemId: string, text: string) => void;
  readonly onRefined: (itemId: string, text: string) => void;
  readonly onError: (message: string) => void;
  readonly fetchImpl?: typeof fetch;
  readonly createSocket?: (url: string, protocols: string[]) => RealtimeSocket;
}): ConversateRealtimeSession {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const socketFactory = options.createSocket ?? createDefaultRealtimeSocket;
  let socket: RealtimeSocket | undefined;
  let refinementSocket: RealtimeSocket | undefined;
  let unsubscribe: (() => void) | undefined;
  let microphoneOpen = false;
  let closing = false;
  const partials = new Map<string, string>();
  const liveItems: string[] = [];
  const refinedTurns: string[] = [];
  let configured = false;
  let usedCompatibilityFallback = false;
  const abort = new AbortController();
  const languages = [...new Set(options.languages ?? [])]
    .filter((value) => /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(value))
    .slice(0, 3);
  const keywords = [...new Set(options.keywords ?? [])]
    .map((value) => value.trim())
    .filter((value) => value && value.length <= 100 && !/[<>\r\n]/.test(value))
    .slice(0, 50);

  const send = (target: RealtimeSocket | undefined, value: unknown) => {
    if (target?.readyState === SOCKET_OPEN) target.send(JSON.stringify(value));
  };

  const sendLiveConfiguration = (extended: boolean) => {
    configured = false;
    send(socket, {
      type: "session.update",
      session: {
        type: "transcription",
        audio: { input: {
          format: { type: "audio/pcm", rate: 24_000 },
          transcription: {
            model: "gpt-live-transcribe",
            delay: extended ? "medium" : "low",
            ...(extended && options.prompt ? { prompt: options.prompt } : {}),
            ...(extended && languages.length ? { languages } : {}),
            ...(extended && keywords.length ? { keywords } : {}),
          },
          turn_detection: {
            type: "server_vad",
            ...(extended ? { threshold: 0.5 } : {}),
            prefix_padding_ms: extended ? 500 : 300,
            silence_duration_ms: extended ? 800 : 500,
          },
        } },
      },
    });
  };

  const publishRefinements = () => {
    // ponytail: same audio and VAD preserve turn order; add timestamp matching if production proves otherwise.
    while (liveItems.length && refinedTurns.length) {
      options.onRefined(liveItems.shift() ?? "", refinedTurns.shift() ?? "");
    }
  };

  const closeMicrophone = async () => {
    if (!microphoneOpen) return;
    await options.bridge.audioControl(false).catch(() => false);
    microphoneOpen = false;
  };

  const openSocket = (secret: string, refinement = false) => new Promise<void>((resolve, reject) => {
    const next = socketFactory(REALTIME_URL, [
      "realtime",
      `openai-insecure-api-key.${secret}`,
    ]);
    if (refinement) refinementSocket = next;
    else socket = next;
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
      } else if (!closing && !refinement) options.onError("Transcription connection failed");
    };
    next.onclose = () => {
      if (!settled) reject(new Error("Transcription connection closed"));
      else if (!closing && !refinement) options.onError("Transcription connection closed");
    };
    next.onmessage = ({ data }) => {
      let event: Record<string, unknown>;
      try { event = JSON.parse(data) as Record<string, unknown>; } catch { return; }
      if (!refinement && event.type === "session.updated") {
        configured = true;
        return;
      }
      if (event.type === "error") {
        if (!refinement && !configured && !usedCompatibilityFallback) {
          const detail = typeof event.error === "object" && event.error !== null
            ? event.error as Record<string, unknown> : {};
          logDiagnostic(
            "ERROR",
            `Conversate config rejected · code ${String(detail.code ?? "unknown").slice(0, 80)}`
              + ` · param ${String(detail.param ?? "unknown").slice(0, 120)}`,
          );
          usedCompatibilityFallback = true;
          sendLiveConfiguration(false);
        } else if (!refinement) options.onError("Transcription session error");
        return;
      }
      const itemId = typeof event.item_id === "string" ? event.item_id : "";
      if (!itemId) return;
      if (!refinement && event.type === "conversation.item.input_audio_transcription.delta") {
        const delta = typeof event.delta === "string" ? event.delta : "";
        const text = `${partials.get(itemId) ?? ""}${delta}`;
        partials.set(itemId, text);
        options.onPartial(itemId, text);
      }
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        const text = typeof event.transcript === "string"
          ? event.transcript.trim()
          : (partials.get(itemId) ?? "").trim();
        if (!refinement) partials.delete(itemId);
        if (text && refinement) {
          refinedTurns.push(text);
          publishRefinements();
        } else if (text) {
          options.onCompleted(itemId, text);
          liveItems.push(itemId);
          publishRefinements();
        }
      }
    };
  });

  return {
    async start() {
      const [secret, refinementSecret] = await Promise.all([
        requestRealtimeClientSecret({
          fetchImpl, key: options.key, signal: abort.signal, purpose: "transcription",
        }),
        requestRealtimeClientSecret({
          fetchImpl, key: options.key, signal: abort.signal, purpose: "transcription",
          transcriptionModel: "gpt-transcribe",
        }).catch(() => undefined),
      ]);
      await openSocket(secret);
      if (refinementSecret) await openSocket(refinementSecret, true).catch(() => {
        refinementSocket?.close();
        refinementSocket = undefined;
      });
      const turnDetection = {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 500,
        silence_duration_ms: 800,
      };
      sendLiveConfiguration(true);
      send(refinementSocket, {
        type: "session.update",
        session: {
          type: "transcription",
          audio: { input: {
            format: { type: "audio/pcm", rate: 24_000 },
            transcription: { model: "gpt-transcribe" },
            turn_detection: turnDetection,
          } },
        },
      });
      unsubscribe = options.bridge.onEvenHubEvent((event) => {
        const audio = event.audioEvent;
        if (!microphoneOpen || socket?.readyState !== SOCKET_OPEN || !audio
          || audio.source !== AudioInputSource.Glasses || audio.audioPcm.length === 0
          || audio.audioPcm.length > MAX_PCM_CHUNK_BYTES) return;
        const bytes = resamplePcm16Le16To24(audio.audioPcm);
        if (bytes.length) {
          const append = createAudioAppendEvent(bytes);
          send(socket, append);
          send(refinementSocket, append);
        }
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
      refinementSocket?.close();
      refinementSocket = undefined;
      await closeMicrophone();
    },
  };
}
