import type { AudioInputSource, EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { requestConversateAnalysis } from "./conversate-analysis";
import { createConversateRealtimeSession } from "./conversate-realtime-session";
import {
  type ConversateInform,
  type ConversateSegment,
  type ConversateSettings,
  type ConversateSnapshot,
  resolveConversateHistory,
  writeConversateHistory,
} from "./conversate-state";
import type { EvenStorage } from "./live-cache";
import type { PhoneLocale } from "./phone-types";
import { logDiagnostic } from "./diagnostic-log";

type Bridge = EvenStorage & {
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

export type ConversateRuntime = {
  start(): Promise<boolean>;
  stop(): Promise<void>;
  tap(): void;
  scroll(delta: -1 | 1): void;
  dispose(): void;
};

const clamp = (value: number, count: number) => Math.min(
  Math.max(0, value),
  Math.max(0, count - 1),
);

const transcriptionLanguage = (locale: PhoneLocale) => locale === "zh-Hans"
  ? "zh-cn"
  : locale === "zh-Hant" ? "zh-tw" : locale.toLowerCase().split("-")[0] ?? "en";

function transcriptionHints(locale: PhoneLocale, settings: ConversateSettings) {
  const languages = [transcriptionLanguage(locale), ...settings.spokenLanguages
    .toLowerCase().split(/[\s,;]+/)]
    .filter((value, index, all) => /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(value)
      && all.indexOf(value) === index)
    .slice(0, 3);
  const keywords = settings.transcriptionKeywords
    .split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean).slice(0, 50);
  const prompt = [
    `Live human conversation. Primary language: ${languages[0]}.`,
    settings.goal.trim() ? `Conversation goal: ${settings.goal.trim()}.` : "",
    settings.prepNote && settings.inform && settings.prepNoteText.trim()
      ? `Context: ${settings.prepNoteText.trim()}` : "",
  ].filter(Boolean).join(" ").slice(0, 2_500);
  return { languages, keywords, prompt };
}

export function createConversateRuntime(options: {
  readonly bridge: Bridge;
  readonly getKey: () => string | undefined;
  readonly getLocale: () => PhoneLocale;
  readonly getSettings: () => ConversateSettings;
  readonly getSnapshot: () => ConversateSnapshot;
  readonly onSnapshot: (snapshot: ConversateSnapshot) => void;
  readonly refresh: () => void | Promise<void>;
  readonly createSession?: typeof createConversateRealtimeSession;
}) : ConversateRuntime {
  let session: ReturnType<typeof createConversateRealtimeSession> | undefined;
  let disposed = false;
  let startedAt = "";
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let analysisAbort: AbortController | undefined;
  let pendingAnalysis = false;

  const publish = (patch: Partial<ConversateSnapshot>) => {
    if (disposed) return;
    options.onSnapshot({ ...options.getSnapshot(), ...patch });
    void options.refresh();
  };

  const scheduleInformHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => publish({ activeInform: undefined }),
      options.getSettings().informSeconds * 1_000);
  };

  const analyzeLatest = async () => {
    if (analysisAbort) {
      pendingAnalysis = true;
      return;
    }
    const key = options.getKey();
    if (!key) return;
    const settings = options.getSettings();
    if (!settings.translation && !settings.inform && !settings.copilot) return;
    const snapshot = options.getSnapshot();
    if (!snapshot.segments.length) return;
    const targetId = snapshot.segments.at(-1)?.id;
    if (!targetId) return;
    logDiagnostic("LIVE", "Conversate analysis start");
    analysisAbort = new AbortController();
    try {
      const result = await requestConversateAnalysis({
        key,
        locale: options.getLocale(),
        settings,
        segments: snapshot.segments,
        signal: analysisAbort.signal,
      });
      const current = options.getSnapshot();
      const segments = [...current.segments];
      const targetIndex = segments.findIndex(({ id }) => id === targetId);
      const target = segments[targetIndex];
      if (target) segments[targetIndex] = {
        ...target,
        language: result.language.slice(0, 24),
        translation: settings.translation && result.translation?.trim()
          ? result.translation.trim().slice(0, 500)
          : undefined,
      };
      const inform: ConversateInform | undefined = settings.inform && result.inform?.trim()
        ? {
            id: `${Date.now()}-inform`,
            text: result.inform.trim().slice(0, 180),
            at: new Date().toISOString(),
          }
        : undefined;
      publish({
        segments,
        suggestions: settings.copilot ? result.suggestions.slice(0, 3) : [],
        selectedSuggestion: 0,
        ...(inform ? {
          informs: [inform, ...current.informs].slice(0, 20),
          activeInform: inform,
          informHistoryOpen: false,
          selectedInform: 0,
        } : {}),
      });
      if (inform) scheduleInformHide();
      logDiagnostic("LIVE", `Conversate analysis complete · Inform ${inform ? "ready" : "empty"}`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        logDiagnostic("ERROR", "Conversate analysis failed");
        publish({ error: "Conversate analysis unavailable" });
      }
    } finally {
      analysisAbort = undefined;
      if (pendingAnalysis) {
        pendingAnalysis = false;
        void analyzeLatest();
      }
    }
  };

  return {
    async start() {
      if (disposed || session) return false;
      const key = options.getKey();
      if (!key) {
        publish({ phase: "error", error: "OpenAI key required" });
        return false;
      }
      startedAt = new Date().toISOString();
      publish({
        phase: "connecting", partial: "", segments: [], informs: [],
        activeInform: undefined, suggestions: [], error: undefined,
      });
      const settings = options.getSettings();
      const hints = transcriptionHints(options.getLocale(), settings);
      session = (options.createSession ?? createConversateRealtimeSession)({
        bridge: options.bridge,
        key,
        locale: options.getLocale(),
        ...hints,
        onPartial: (_itemId, text) => publish({ partial: text.slice(-500) }),
        onCompleted: (itemId, text) => {
          const current = options.getSnapshot();
          const segment: ConversateSegment = {
            id: itemId,
            text: text.slice(0, 500),
            at: new Date().toISOString(),
          };
          publish({
            partial: "",
            segments: [...current.segments, segment].slice(-200),
            phase: "listening",
          });
          void analyzeLatest();
        },
        onRefined: (itemId, text) => {
          const current = options.getSnapshot();
          const index = current.segments.findIndex(({ id }) => id === itemId);
          if (index < 0 || current.segments[index]?.text === text) return;
          const segments = [...current.segments];
          const segment = segments[index];
          if (!segment) return;
          segments[index] = { ...segment, text: text.slice(0, 500) };
          publish({ segments });
        },
        onError: (error) => publish({ phase: "error", error }),
      });
      try {
        await session.start();
        publish({ phase: "listening", error: undefined });
        return true;
      } catch (error) {
        const failed = session;
        session = undefined;
        await failed?.stop();
        publish({
          phase: "error",
          error: error instanceof Error ? error.message.slice(0, 160) : "Conversate failed",
        });
        return false;
      }
    },
    async stop() {
      const active = session;
      session = undefined;
      clearTimeout(hideTimer);
      analysisAbort?.abort();
      analysisAbort = undefined;
      await active?.stop();
      const snapshot = options.getSnapshot();
      const history = await resolveConversateHistory(options.bridge);
      const nextHistory = options.getSettings().transcription && snapshot.segments.length
        ? [{
            id: `${Date.now()}-conversation`,
            startedAt: startedAt || new Date().toISOString(),
            endedAt: new Date().toISOString(),
            segments: snapshot.segments,
            informs: snapshot.informs,
          }, ...history].slice(0, 20)
        : history;
      await writeConversateHistory(options.bridge, nextHistory);
      publish({
        phase: "idle", partial: "", history: nextHistory,
        activeInform: undefined, informHistoryOpen: false, error: undefined,
      });
    },
    tap() {
      const current = options.getSnapshot();
      if (current.activeInform) {
        clearTimeout(hideTimer);
        publish({ activeInform: undefined });
      } else if (current.informHistoryOpen && current.informs.length) {
        publish({ activeInform: current.informs[current.selectedInform], informHistoryOpen: false });
        scheduleInformHide();
      } else if (current.informs.length) {
        publish({ informHistoryOpen: true, selectedInform: 0 });
      }
    },
    scroll(delta) {
      const current = options.getSnapshot();
      if (current.informHistoryOpen) {
        publish({ selectedInform: clamp(current.selectedInform + delta, current.informs.length) });
      } else {
        publish({ selectedSuggestion: clamp(
          current.selectedSuggestion + delta,
          current.suggestions.length,
        ) });
      }
    },
    dispose() {
      disposed = true;
      clearTimeout(hideTimer);
      analysisAbort?.abort();
      void session?.stop();
      session = undefined;
    },
  };
}
