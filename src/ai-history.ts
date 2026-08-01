import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";

const MAX_EXCERPTS = 3;
const MAX_TEXT_LENGTH = 160;

export type AiConversationExcerpt = {
  readonly id: string;
  readonly endedAt: string;
  readonly user: string;
  readonly assistant: string;
};

function cleanExcerptText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
}

function normalizeExcerpt(
  value: AiConversationExcerpt,
): AiConversationExcerpt {
  return {
    id: value.id.slice(0, 96),
    endedAt: value.endedAt,
    user: cleanExcerptText(value.user),
    assistant: cleanExcerptText(value.assistant),
  };
}

function isExcerpt(value: unknown): value is AiConversationExcerpt {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && typeof item.endedAt === "string"
    && !Number.isNaN(Date.parse(item.endedAt))
    && typeof item.user === "string"
    && typeof item.assistant === "string";
}

function isHistory(value: unknown): value is readonly AiConversationExcerpt[] {
  return Array.isArray(value)
    && value.length <= MAX_EXCERPTS
    && value.every(isExcerpt);
}

export function appendAiConversationExcerpt(
  history: readonly AiConversationExcerpt[],
  excerpt: AiConversationExcerpt,
): readonly AiConversationExcerpt[] {
  const normalized = normalizeExcerpt(excerpt);
  return [
    normalized,
    ...history.filter(({ id }) => id !== normalized.id).map(normalizeExcerpt),
  ].slice(0, MAX_EXCERPTS);
}

export async function resolveAiConversationHistory(
  storage: EvenStorage,
): Promise<readonly AiConversationExcerpt[]> {
  return await readCache(storage, "ai-history", isHistory) ?? [];
}

export function writeAiConversationHistory(
  storage: EvenStorage,
  history: readonly AiConversationExcerpt[],
): Promise<boolean> {
  return writeCache(
    storage,
    "ai-history",
    history.slice(0, MAX_EXCERPTS).map(normalizeExcerpt),
  );
}

export function clearAiConversationHistory(
  storage: EvenStorage,
): Promise<boolean> {
  return clearCache(storage, "ai-history");
}
