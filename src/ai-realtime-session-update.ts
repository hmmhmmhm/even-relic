import { BUILTIN_AI_TOOLS } from "./ai-tools";
import {
  projectRealtimeMcpTools,
  type McpServerConfig,
} from "./mcp-servers";
import type { PhoneLocale } from "./phone-types";

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

export function createRealtimeSessionUpdate(
  locale: PhoneLocale,
  mcpServers: readonly McpServerConfig[] = [],
) {
  return {
    type: "session.update" as const,
    session: {
      type: "realtime" as const,
      model: "gpt-realtime",
      output_modalities: ["text"] as const,
      tools: [...BUILTIN_AI_TOOLS, ...projectRealtimeMcpTools(mcpServers)],
      tool_choice: "auto" as const,
      instructions: "You are a concise, helpful assistant for smart glasses. "
        + `Reply in ${languageInstruction(locale)} unless the user asks otherwise. `
        + "Use short paragraphs that are easy to read on a heads-up display. "
        + "Never guess the current time or exact location: call the matching tool. "
        + "Use web search for current information and cite its numbered sources. "
        + "Call get_current_location only when location is relevant to the request.",
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
