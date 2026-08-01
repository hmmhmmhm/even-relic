import type { AiConversationTurn } from "./ai-realtime-protocol";
import { wrapHudText } from "./fast-detail-text";

const MAXIMUM_LINE_UNITS = 46;
export const AI_TRANSCRIPT_VISIBLE_LINES = 9;

function roleLines(label: "YOU" | "AI", text: string): readonly string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const prefix = `${label} // `;
  const continuation = " ".repeat(prefix.length);
  return wrapHudText(
    normalized,
    MAXIMUM_LINE_UNITS - prefix.length,
    1024,
  ).map((line, index) => `${index === 0 ? prefix : continuation}${line}`);
}

export function createAiTranscriptLines(
  completed: readonly AiConversationTurn[],
  current: AiConversationTurn,
): readonly string[] {
  const turns = current.user.trim() || current.assistant.trim()
    ? [...completed, current]
    : completed;
  return turns.flatMap((turn) => [
    ...roleLines("YOU", turn.user),
    ...roleLines("AI", turn.assistant),
  ]);
}

export function selectAiTranscriptViewport(
  lines: readonly string[],
  selectedLine: number,
  visibleLines = AI_TRANSCRIPT_VISIBLE_LINES,
): readonly string[] {
  if (lines.length === 0 || visibleLines <= 0) return [];
  const endLine = Math.min(
    Math.max(0, Math.floor(selectedLine)),
    lines.length - 1,
  );
  const startLine = Math.max(0, endLine - Math.floor(visibleLines) + 1);
  return lines.slice(startLine, endLine + 1);
}
