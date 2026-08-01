import type { AiConversationExcerpt } from "./ai-history";
import type {
  AiRealtimePhase,
  AiRealtimeProtocolState,
} from "./ai-realtime-protocol";
import { createAiTranscriptPages } from "./ai-transcript";

export type AiHudPhase = "unconfigured" | AiRealtimePhase;

export type AiHudSnapshot = {
  readonly configured: boolean;
  readonly phase: AiHudPhase;
  readonly userText: string;
  readonly assistantText: string;
  readonly transcriptPages: readonly string[];
  readonly history: readonly AiConversationExcerpt[];
  readonly weekUsd: number;
  readonly monthUsd: number;
  readonly error?: string;
};

export function createAiHudSnapshot(
  configured: boolean,
  history: readonly AiConversationExcerpt[] = [],
  weekUsd = 0,
  monthUsd = 0,
): AiHudSnapshot {
  return {
    configured,
    phase: configured ? "idle" : "unconfigured",
    userText: "",
    assistantText: "",
    transcriptPages: [],
    history: history.slice(0, 3),
    weekUsd,
    monthUsd,
  };
}

export function updateAiHudProtocol(
  current: AiHudSnapshot,
  protocol: AiRealtimeProtocolState,
): AiHudSnapshot {
  return {
    ...current,
    phase: protocol.phase,
    userText: protocol.userText,
    assistantText: protocol.assistantText,
    transcriptPages: createAiTranscriptPages(
      protocol.turns,
      {
        user: protocol.userText,
        assistant: protocol.assistantText,
      },
    ),
    error: protocol.error,
  };
}
