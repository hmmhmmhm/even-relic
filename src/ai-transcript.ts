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
  const pages: string[] = [];
  let pending: string[] = [];
  const flush = () => {
    if (!pending.length) return;
    pages.push(pending.join("\n"));
    pending = [];
  };
  for (const turn of turns) {
    const lines = [
      ...roleLines("YOU", turn.user),
      ...roleLines("AI", turn.assistant),
    ];
    if (!lines.length) continue;
    if (lines.length <= LINES_PER_PAGE) {
      if (pending.length + lines.length > LINES_PER_PAGE) flush();
      pending.push(...lines);
      if (pending.length === LINES_PER_PAGE) flush();
      continue;
    }
    flush();
    for (let index = 0; index < lines.length; index += LINES_PER_PAGE) {
      pages.push(lines.slice(index, index + LINES_PER_PAGE).join("\n"));
    }
  }
  flush();
  return pages;
}
