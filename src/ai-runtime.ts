import type { AudioInputSource, EvenHubEvent } from "@evenrealities/even_hub_sdk";
import {
  addDailyAiUsage,
  estimateAiUsageUsd,
  resolveAiUsageLedger,
  usageForCurrentMonth,
  usageForCurrentWeek,
  writeAiUsageLedger,
} from "./ai-cost";
import {
  appendAiConversationExcerpt,
  resolveAiConversationHistory,
  writeAiConversationHistory,
} from "./ai-history";
import {
  type AiHudSnapshot,
  createAiHudSnapshot,
  updateAiHudProtocol,
} from "./ai-hud-state";
import { createAiRealtimeSession } from "./ai-realtime-session";
import type { AiRealtimeProtocolState } from "./ai-realtime-protocol";
import { createAiRefreshScheduler } from "./ai-refresh-scheduler";
import type { EvenStorage } from "./live-cache";
import type { PhoneLocale } from "./phone-types";

type AiBridge = EvenStorage & {
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

export type AiRuntime = {
  start(): Promise<boolean>;
  toggle(): Promise<boolean>;
  stop(): Promise<void>;
  dispose(): void;
};

export function createAiRuntime(options: {
  readonly bridge: AiBridge;
  readonly getKey: () => string | undefined;
  readonly getLocale: () => PhoneLocale;
  readonly getSnapshot: () => AiHudSnapshot;
  readonly onSnapshot: (snapshot: AiHudSnapshot) => void;
  readonly refresh: () => void | Promise<void>;
  readonly createSession?: typeof createAiRealtimeSession;
}): AiRuntime {
  let session: ReturnType<typeof createAiRealtimeSession> | undefined;
  let disposed = false;
  const scheduler = createAiRefreshScheduler(options.refresh, 300);

  const publish = (snapshot: AiHudSnapshot, final = false) => {
    if (disposed) return;
    options.onSnapshot(snapshot);
    if (final) void scheduler.final();
    else scheduler.request();
  };

  const persist = async (
    protocol: AiRealtimeProtocolState,
  ) => {
    const now = new Date();
    const [history, ledger] = await Promise.all([
      resolveAiConversationHistory(options.bridge),
      resolveAiUsageLedger(options.bridge),
    ]);
    const nextHistory = protocol.userText || protocol.assistantText
      ? appendAiConversationExcerpt(history, {
          id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
          endedAt: now.toISOString(),
          user: protocol.userText,
          assistant: protocol.assistantText,
        })
      : history;
    const nextLedger = addDailyAiUsage(ledger, now, protocol.usage);
    await Promise.all([
      writeAiConversationHistory(options.bridge, nextHistory),
      writeAiUsageLedger(options.bridge, nextLedger),
    ]);
    publish(createAiHudSnapshot(
      Boolean(options.getKey()),
      nextHistory,
      estimateAiUsageUsd(usageForCurrentWeek(nextLedger, now)),
      estimateAiUsageUsd(usageForCurrentMonth(nextLedger, now)),
    ), true);
  };

  return {
    async start() {
      if (disposed || session) return false;
      const key = options.getKey();
      if (!key) {
        publish({
          ...options.getSnapshot(),
          configured: false,
          phase: "unconfigured",
          error: "OpenAI key required",
        }, true);
        return false;
      }
      session = (options.createSession ?? createAiRealtimeSession)({
        bridge: options.bridge,
        key,
        locale: options.getLocale(),
        onState: (protocol) => {
          const snapshot = updateAiHudProtocol(
            options.getSnapshot(),
            protocol,
          );
          publish(snapshot, protocol.phase === "error");
        },
      });
      try {
        await session.start();
        return true;
      } catch {
        session = undefined;
        return false;
      }
    },
    async toggle() {
      if (!session) return false;
      const phase = session.getState().phase;
      if (phase === "paused") await session.resume();
      else if (phase === "listening" || phase === "thinking") {
        await session.pause();
      } else {
        return false;
      }
      return true;
    },
    async stop() {
      const active = session;
      session = undefined;
      if (!active) return;
      const protocol = await active.stop();
      await persist(protocol);
    },
    dispose() {
      disposed = true;
      scheduler.dispose();
      const active = session;
      session = undefined;
      void active?.stop();
    },
  };
}
