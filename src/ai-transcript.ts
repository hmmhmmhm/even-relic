import type { AiConversationTurn } from "./ai-realtime-protocol";
import { wrapHudText } from "./fast-detail-text";

const MAXIMUM_LINE_UNITS = 46;
const LINES_PER_PAGE = 6;

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

export function createAiTranscriptPages(
  completed: readonly AiConversationTurn[],
  current: AiConversationTurn,
): readonly string[] {
  const turns = current.user.trim() || current.assistant.trim()
    ? [...completed, current]
    : completed;
  const lines = turns.flatMap((turn) => [
    ...roleLines("YOU", turn.user),
    ...roleLines("AI", turn.assistant),
  ]);
  const pages: string[] = [];
  for (let index = 0; index < lines.length; index += LINES_PER_PAGE) {
    pages.push(lines.slice(index, index + LINES_PER_PAGE).join("\n"));
  }
  return pages;
}
