import { describe, expect, it, vi } from "vitest";
import { EMPTY_AI_USAGE } from "./ai-cost";
import { resolveAiConversationHistory } from "./ai-history";
import { createAiHudSnapshot } from "./ai-hud-state";
import { createRealtimeProtocolState } from "./ai-realtime-protocol";
import { createAiRuntime } from "./ai-runtime";
import type { EvenStorage } from "./live-cache";

class TestBridge implements EvenStorage {
  readonly values = new Map<string, string>();
  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
  async audioControl() { return true; }
  onEvenHubEvent() { return vi.fn(); }
}

describe("Ask AI runtime", () => {
  it("starts only with BYOK and persists one local excerpt and usage on exit", async () => {
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(true);
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "listening" as const,
      userText: "오늘 일정을 알려줘",
      assistantText: "오후 세 시에 검토 일정이 있습니다.",
      usage: { ...EMPTY_AI_USAGE, audioInputTokens: 100, textOutputTokens: 20 },
    };
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => protocol);
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh: vi.fn(),
      createSession: vi.fn(() => ({
        start,
        pause: vi.fn(),
        resume: vi.fn(),
        stop,
        getState: () => protocol,
      })),
    });

    await expect(runtime.start()).resolves.toBe(true);
    expect(start).toHaveBeenCalledOnce();
    await runtime.stop();

    expect(stop).toHaveBeenCalledOnce();
    await expect(resolveAiConversationHistory(bridge)).resolves.toEqual([
      expect.objectContaining({
        user: "오늘 일정을 알려줘",
        assistant: "오후 세 시에 검토 일정이 있습니다.",
      }),
    ]);
    expect(snapshot.history).toHaveLength(1);
    expect(snapshot.weekUsd).toBeGreaterThan(0);
    expect(snapshot.monthUsd).toBe(snapshot.weekUsd);
  });

  it("does not create a session when no key is configured", async () => {
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(false);
    const createSession = vi.fn();
    const runtime = createAiRuntime({
      bridge,
      getKey: () => undefined,
      getLocale: () => "en",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh: vi.fn(),
      createSession,
    });

    await expect(runtime.start()).resolves.toBe(false);
    expect(createSession).not.toHaveBeenCalled();
    expect(snapshot).toMatchObject({
      configured: false,
      phase: "unconfigured",
    });
  });

  it("persists the latest non-empty turn before a delayed placeholder", async () => {
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(true);
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "listening" as const,
      turns: [{
        user: "완료된 질문",
        assistant: "완료된 답변",
      }, {
        user: "",
        assistant: "",
      }],
    };
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh: vi.fn(),
      createSession: vi.fn(() => ({
        start: vi.fn(async () => undefined),
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(async () => protocol),
        getState: () => protocol,
      })),
    });

    await runtime.start();
    await runtime.stop();

    await expect(resolveAiConversationHistory(bridge)).resolves.toEqual([
      expect.objectContaining({
        user: "완료된 질문",
        assistant: "완료된 답변",
      }),
    ]);
  });
});
