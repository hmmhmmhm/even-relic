import type { AiConversationExcerpt } from "./ai-history";
import type {
  AiRealtimePhase,
  AiRealtimeProtocolState,
} from "./ai-realtime-protocol";

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

function chunkText(text: string, maximum = 170): readonly string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maximum) {
    const candidate = remaining.slice(0, maximum + 1);
    const split = Math.max(
      candidate.lastIndexOf(" "),
      candidate.lastIndexOf("."),
      candidate.lastIndexOf("。"),
    );
    const end = split >= maximum * 0.55 ? split + 1 : maximum;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function transcriptPages(user: string, assistant: string): readonly string[] {
  const userPages = chunkText(user).map((text) => `YOU // ${text}`);
  const assistantPages = chunkText(assistant).map((text) => `AI // ${text}`);
  return [...userPages, ...assistantPages].slice(-12);
}

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
    transcriptPages: transcriptPages(
      protocol.userText,
      protocol.assistantText,
    ),
    error: protocol.error,
  };
}
