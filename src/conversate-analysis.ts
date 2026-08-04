import { openAiKeyHeaders } from "./openai-key";
import type {
  ConversateSegment,
  ConversateSettings,
  ConversateSuggestion,
} from "./conversate-state";
import type { PhoneLocale } from "./phone-types";

export type ConversateAnalysis = {
  readonly language: string;
  readonly translation?: string;
  readonly inform?: string;
  readonly suggestions: readonly ConversateSuggestion[];
};

function isAnalysis(value: unknown): value is ConversateAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.language === "string"
    && (item.translation === undefined || typeof item.translation === "string")
    && (item.inform === undefined || typeof item.inform === "string")
    && Array.isArray(item.suggestions)
    && item.suggestions.every((suggestion) => (
      typeof suggestion === "object" && suggestion !== null
      && ["original", "pronunciation", "meaning", "style"].every(
        (key) => typeof (suggestion as Record<string, unknown>)[key] === "string",
      )
    ));
}

export async function requestConversateAnalysis(options: {
  readonly key: string;
  readonly locale: PhoneLocale;
  readonly settings: ConversateSettings;
  readonly segments: readonly ConversateSegment[];
  readonly signal: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<ConversateAnalysis> {
  const response = await (options.fetchImpl ?? fetch)("/api/conversate-analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...openAiKeyHeaders(options.key),
    },
    body: JSON.stringify({
      locale: options.locale,
      settings: options.settings,
      transcript: options.segments.slice(-8).map(({ text }) => text),
    }),
    signal: options.signal,
  });
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("Conversate analysis unavailable");
  }
  if (!response.ok || !isAnalysis(value)) {
    throw new Error("Conversate analysis unavailable");
  }
  return value;
}
