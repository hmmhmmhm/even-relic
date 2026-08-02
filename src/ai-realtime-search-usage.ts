import { addAiUsage, EMPTY_AI_USAGE } from "./ai-cost";
import { mergeAiUsageCharge, priceSearchUsage } from "./ai-pricing";
import type { AiRealtimeProtocolState } from "./ai-realtime-protocol";
import type { AiCitationSource, AiWebSearchUsage } from "./ai-tools";

export function mergeAiCitationSources(
  state: AiRealtimeProtocolState,
  sources: readonly AiCitationSource[],
): AiRealtimeProtocolState {
  const merged = [...state.sources];
  for (const source of sources) {
    if (!merged.some(({ url }) => url === source.url)) merged.push(source);
  }
  return { ...state, sources: merged.slice(-6) };
}

export function addAiSearchUsage(
  state: AiRealtimeProtocolState,
  usage: AiWebSearchUsage,
): AiRealtimeProtocolState {
  const cachedInputTokens = Math.min(
    usage.inputTokens,
    usage.cachedInputTokens,
  );
  return {
    ...state,
    usage: addAiUsage(state.usage, {
      ...EMPTY_AI_USAGE,
      searchTextInputTokens: Math.max(
        0,
        usage.inputTokens - cachedInputTokens,
      ),
      cachedSearchTextInputTokens: cachedInputTokens,
      searchTextOutputTokens: usage.outputTokens,
      webSearchCalls: usage.webSearchCalls,
    }),
    charge: mergeAiUsageCharge(state.charge, priceSearchUsage(usage)),
  };
}
