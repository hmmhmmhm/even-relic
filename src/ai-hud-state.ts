import type { AiConversationExcerpt } from "./ai-history";
import type {
  AiConversationTurn,
  AiRealtimePhase,
  AiRealtimeProtocolState,
} from "./ai-realtime-protocol";
import { createAiTranscriptLines } from "./ai-transcript";
import type { AiMcpApproval } from "./ai-realtime-tools";
import type { AiActiveTool } from "./ai-realtime-tools";

export type AiHudPhase = "unconfigured" | "displaying" | AiRealtimePhase;

export type AiHudSnapshot = {
  readonly configured: boolean;
  readonly phase: AiHudPhase;
  readonly userText: string;
  readonly assistantText: string;
  readonly turns: readonly AiConversationTurn[];
  readonly transcriptLines: readonly string[];
  readonly history: readonly AiConversationExcerpt[];
  readonly weekUsd: number;
  readonly monthUsd: number;
  readonly responseComplete: boolean;
  readonly activeTool?: AiActiveTool;
  readonly pendingApproval?: AiMcpApproval;
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
    turns: [],
    transcriptLines: [],
    history: history.slice(0, 3),
    weekUsd,
    monthUsd,
    responseComplete: false,
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
    turns: protocol.turns,
    transcriptLines: createAiTranscriptLines(
      protocol.turns,
      {
        user: protocol.userText,
        assistant: protocol.assistantText,
      },
    ),
    pendingApproval: protocol.pendingApproval,
    activeTool: protocol.activeTool,
    responseComplete: protocol.responseComplete,
    error: protocol.error,
  };
}
