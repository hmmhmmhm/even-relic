import {
  addAiUsage,
  EMPTY_AI_USAGE,
  type AiUsage,
} from "./ai-cost";
import type { PhoneLocale } from "./phone-types";

export type AiRealtimePhase =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "error";

export type AiConversationTurn = {
  readonly user: string;
  readonly assistant: string;
};

type AiConversationTurnRef = {
  readonly userItemId?: string;
  readonly responseId?: string;
};

export type AiRealtimeProtocolState = {
  readonly phase: AiRealtimePhase;
  readonly turns: readonly AiConversationTurn[];
  readonly userText: string;
  readonly assistantText: string;
  readonly usage: AiUsage;
  readonly activeUserItemId?: string;
  readonly activeResponseId?: string;
  readonly retiredUserItemIds: readonly string[];
  readonly retiredResponseIds: readonly string[];
  readonly turnRefs: readonly AiConversationTurnRef[];
  readonly error?: string;
};

type RealtimeServerEvent = {
  readonly type?: string;
  readonly item_id?: string;
  readonly response_id?: string;
  readonly transcript?: string;
  readonly delta?: string;
  readonly text?: string;
  readonly error?: { readonly message?: string };
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly input_token_details?: {
      readonly text_tokens?: number;
      readonly audio_tokens?: number;
    };
    readonly output_token_details?: { readonly text_tokens?: number };
  };
  readonly response?: {
    readonly id?: string;
    readonly usage?: {
      readonly input_tokens?: number;
      readonly output_tokens?: number;
      readonly input_token_details?: {
        readonly text_tokens?: number;
        readonly audio_tokens?: number;
        readonly cached_tokens?: number;
        readonly cached_text_tokens?: number;
        readonly cached_audio_tokens?: number;
        readonly cached_tokens_details?: {
          readonly text_tokens?: number;
          readonly audio_tokens?: number;
        };
      };
      readonly output_token_details?: { readonly text_tokens?: number };
    };
  };
};

function languageInstruction(locale: PhoneLocale): string {
  const names: Partial<Record<PhoneLocale, string>> = {
    en: "English",
    ko: "Korean",
    ja: "Japanese",
    "zh-Hans": "Simplified Chinese",
    "zh-Hant": "Traditional Chinese",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic",
    hi: "Hindi",
    he: "Hebrew",
  };
  return names[locale] ?? `the user's selected language (${locale})`;
}

function transcriptionLanguage(locale: PhoneLocale): string {
  if (locale === "zh-Hans" || locale === "zh-Hant") return "zh";
  if (locale === "fil") return "tl";
  return locale;
}

export function createRealtimeSessionUpdate(locale: PhoneLocale) {
  return {
    type: "session.update" as const,
    session: {
      type: "realtime" as const,
      model: "gpt-realtime",
      output_modalities: ["text"] as const,
      instructions: "You are a concise, helpful assistant for smart glasses. "
        + `Reply in ${languageInstruction(locale)} unless the user asks otherwise. `
        + "Use short paragraphs that are easy to read on a heads-up display.",
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24_000 },
          noise_reduction: { type: "far_field" },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: transcriptionLanguage(locale),
          },
          turn_detection: {
            type: "semantic_vad",
            eagerness: "auto",
            create_response: true,
            interrupt_response: true,
          },
        },
      },
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    output += alphabet[(value >> 18) & 63];
    output += alphabet[(value >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(value >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[value & 63] : "=";
  }
  return output;
}

export function createAudioAppendEvent(bytes: Uint8Array) {
  return {
    type: "input_audio_buffer.append" as const,
    audio: bytesToBase64(bytes),
  };
}

export function resamplePcm16Le16To24(bytes: Uint8Array): Uint8Array {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  if (sampleCount === 0) return new Uint8Array();
  const input = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    sampleCount * 2,
  );
  const outputSampleCount = Math.round(sampleCount * 1.5);
  const output = new Uint8Array(outputSampleCount * 2);
  const view = new DataView(output.buffer);
  for (let index = 0; index < outputSampleCount; index += 1) {
    const position = index * 2 / 3;
    const lowerIndex = Math.min(Math.floor(position), sampleCount - 1);
    const upperIndex = Math.min(lowerIndex + 1, sampleCount - 1);
    const ratio = position - lowerIndex;
    const lower = input.getInt16(lowerIndex * 2, true);
    const upper = input.getInt16(upperIndex * 2, true);
    const sample = Math.max(
      -32_768,
      Math.min(32_767, Math.round(lower + (upper - lower) * ratio)),
    );
    view.setInt16(index * 2, sample, true);
  }
  return output;
}

export function createRealtimeProtocolState(): AiRealtimeProtocolState {
  return {
    phase: "idle",
    turns: [],
    userText: "",
    assistantText: "",
    usage: EMPTY_AI_USAGE,
    retiredUserItemIds: [],
    retiredResponseIds: [],
    turnRefs: [],
  };
}

function token(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function usageFromResponse(event: RealtimeServerEvent): AiUsage {
  const usage = event.response?.usage;
  const input = usage?.input_token_details;
  const output = usage?.output_token_details;
  const totalText = token(input?.text_tokens ?? usage?.input_tokens);
  const totalAudio = token(input?.audio_tokens);
  const cachedTotal = token(input?.cached_tokens);
  let cachedText = token(
    input?.cached_tokens_details?.text_tokens ?? input?.cached_text_tokens,
  );
  let cachedAudio = token(
    input?.cached_tokens_details?.audio_tokens ?? input?.cached_audio_tokens,
  );
  let unclassifiedCached = Math.max(
    0,
    cachedTotal - cachedText - cachedAudio,
  );
  const extraText = Math.min(
    unclassifiedCached,
    Math.max(0, totalText - cachedText),
  );
  cachedText += extraText;
  unclassifiedCached -= extraText;
  cachedAudio += Math.min(
    unclassifiedCached,
    Math.max(0, totalAudio - cachedAudio),
  );
  return {
    ...EMPTY_AI_USAGE,
    textInputTokens: Math.max(0, totalText - cachedText),
    cachedTextInputTokens: cachedText,
    audioInputTokens: Math.max(0, totalAudio - cachedAudio),
    cachedAudioInputTokens: cachedAudio,
    textOutputTokens: token(output?.text_tokens ?? usage?.output_tokens),
  };
}

function usageFromTranscription(event: RealtimeServerEvent): AiUsage {
  const usage = event.usage;
  return {
    ...EMPTY_AI_USAGE,
    transcriptionAudioInputTokens: token(
      usage?.input_token_details?.audio_tokens ?? usage?.input_tokens,
    ),
    transcriptionTextOutputTokens: token(
      usage?.output_token_details?.text_tokens ?? usage?.output_tokens,
    ),
  };
}

function boundedText(value: string, maximum = 4_000): string {
  return value.replace(/\u0000/g, "").slice(-maximum);
}

type ConversationTimeline = {
  turns: readonly AiConversationTurn[];
  turnRefs: readonly AiConversationTurnRef[];
};

function boundTimeline(
  turns: readonly AiConversationTurn[],
  turnRefs: readonly AiConversationTurnRef[],
): ConversationTimeline {
  const entries = turns.map((turn, index) => ({
    turn,
    ref: turnRefs[index] ?? {},
  })).slice(-12);
  let characters = entries.reduce(
    (total, entry) => total
      + entry.turn.user.length
      + entry.turn.assistant.length,
    0,
  );
  while (entries.length > 1 && characters > 8_000) {
    const removed = entries.shift();
    characters -= (removed?.turn.user.length ?? 0)
      + (removed?.turn.assistant.length ?? 0);
  }
  return {
    turns: entries.map((entry) => entry.turn),
    turnRefs: entries.map((entry) => entry.ref),
  };
}

function archiveCurrentTurn(
  state: AiRealtimeProtocolState,
): ConversationTimeline {
  const user = boundedText(state.userText).trim();
  const assistant = boundedText(state.assistantText).trim();
  if (
    !user
    && !assistant
    && !state.activeUserItemId
    && !state.activeResponseId
  ) {
    return { turns: state.turns, turnRefs: state.turnRefs };
  }
  return boundTimeline(
    [...state.turns, { user, assistant }],
    [
      ...state.turnRefs,
      {
        userItemId: state.activeUserItemId,
        responseId: state.activeResponseId,
      },
    ],
  );
}

function retireId(
  ids: readonly string[],
  id: string | undefined,
): readonly string[] {
  if (!id || ids.includes(id)) return ids;
  return [...ids, id].slice(-12);
}

function isRetired(ids: readonly string[], id: string | undefined): boolean {
  return Boolean(id && ids.includes(id));
}

function acceptsUserItem(
  state: AiRealtimeProtocolState,
  itemId: string | undefined,
): boolean {
  if (!itemId) return true;
  if (isRetired(state.retiredUserItemIds, itemId)) return false;
  return !state.activeUserItemId || state.activeUserItemId === itemId;
}

function responseId(event: RealtimeServerEvent): string | undefined {
  return event.response_id ?? event.response?.id;
}

function acceptsResponse(
  state: AiRealtimeProtocolState,
  id: string | undefined,
): boolean {
  if (!id) return true;
  if (isRetired(state.retiredResponseIds, id)) return false;
  return !state.activeResponseId || state.activeResponseId === id;
}

function updateArchivedTurn(
  state: AiRealtimeProtocolState,
  key: keyof AiConversationTurnRef,
  id: string | undefined,
  update: (turn: AiConversationTurn) => AiConversationTurn,
): ConversationTimeline {
  if (!id) return { turns: state.turns, turnRefs: state.turnRefs };
  const index = state.turnRefs.findIndex((ref) => ref[key] === id);
  if (index < 0) return { turns: state.turns, turnRefs: state.turnRefs };
  return boundTimeline(
    state.turns.map((turn, turnIndex) => (
      turnIndex === index ? update(turn) : turn
    )),
    state.turnRefs,
  );
}

export function reduceRealtimeServerEvent(
  state: AiRealtimeProtocolState,
  event: RealtimeServerEvent,
): AiRealtimeProtocolState {
  switch (event.type) {
    case "session.created":
    case "session.updated":
      return { ...state, phase: "listening", error: undefined };
    case "input_audio_buffer.speech_started": {
      const archived = archiveCurrentTurn(state);
      return {
        ...state,
        phase: "listening",
        turns: archived.turns,
        turnRefs: archived.turnRefs,
        userText: "",
        assistantText: "",
        activeUserItemId: event.item_id,
        activeResponseId: undefined,
        retiredUserItemIds: retireId(
          state.retiredUserItemIds,
          state.activeUserItemId,
        ),
        retiredResponseIds: retireId(
          state.retiredResponseIds,
          state.activeResponseId,
        ),
        error: undefined,
      };
    }
    case "input_audio_buffer.speech_stopped":
      return { ...state, phase: "thinking" };
    case "response.created": {
      const id = responseId(event);
      if (!acceptsResponse(state, id)) return state;
      return {
        ...state,
        phase: "thinking",
        activeResponseId: id ?? state.activeResponseId,
      };
    }
    case "conversation.item.input_audio_transcription.delta": {
      if (isRetired(state.retiredUserItemIds, event.item_id)) {
        const timeline = updateArchivedTurn(
          state,
          "userItemId",
          event.item_id,
          (turn) => ({
            ...turn,
            user: boundedText(turn.user + (event.delta ?? "")),
          }),
        );
        return {
          ...state,
          ...timeline,
        };
      }
      if (!acceptsUserItem(state, event.item_id)) return state;
      return {
        ...state,
        activeUserItemId: event.item_id ?? state.activeUserItemId,
        userText: boundedText(state.userText + (event.delta ?? "")),
      };
    }
    case "conversation.item.input_audio_transcription.completed": {
      if (isRetired(state.retiredUserItemIds, event.item_id)) {
        const timeline = updateArchivedTurn(
          state,
          "userItemId",
          event.item_id,
          (turn) => ({
            ...turn,
            user: boundedText(event.transcript ?? turn.user),
          }),
        );
        return {
          ...state,
          ...timeline,
          usage: addAiUsage(state.usage, usageFromTranscription(event)),
        };
      }
      if (!acceptsUserItem(state, event.item_id)) return state;
      return {
        ...state,
        activeUserItemId: event.item_id ?? state.activeUserItemId,
        userText: boundedText(event.transcript ?? state.userText),
        usage: addAiUsage(state.usage, usageFromTranscription(event)),
      };
    }
    case "response.output_text.delta":
    case "response.text.delta": {
      const id = responseId(event);
      if (isRetired(state.retiredResponseIds, id)) {
        const timeline = updateArchivedTurn(
          state,
          "responseId",
          id,
          (turn) => ({
            ...turn,
            assistant: boundedText(turn.assistant + (event.delta ?? "")),
          }),
        );
        return {
          ...state,
          ...timeline,
        };
      }
      if (!acceptsResponse(state, id)) return state;
      return {
        ...state,
        phase: "thinking",
        activeResponseId: id ?? state.activeResponseId,
        assistantText: boundedText(state.assistantText + (event.delta ?? "")),
      };
    }
    case "response.output_text.done": {
      const id = responseId(event);
      if (isRetired(state.retiredResponseIds, id)) {
        const timeline = updateArchivedTurn(
          state,
          "responseId",
          id,
          (turn) => ({
            ...turn,
            assistant: boundedText(event.text ?? turn.assistant),
          }),
        );
        return {
          ...state,
          ...timeline,
        };
      }
      if (!acceptsResponse(state, id)) return state;
      return {
        ...state,
        activeResponseId: id ?? state.activeResponseId,
        assistantText: boundedText(event.text ?? state.assistantText),
      };
    }
    case "response.done": {
      const id = responseId(event);
      if (isRetired(state.retiredResponseIds, id)) {
        return {
          ...state,
          usage: addAiUsage(state.usage, usageFromResponse(event)),
        };
      }
      if (!acceptsResponse(state, id)) return state;
      return {
        ...state,
        phase: "listening",
        activeResponseId: id ?? state.activeResponseId,
        usage: addAiUsage(state.usage, usageFromResponse(event)),
      };
    }
    case "error":
      return {
        ...state,
        phase: "error",
        error: boundedText(event.error?.message ?? "Realtime session failed", 160),
      };
    default:
      return state;
  }
}
