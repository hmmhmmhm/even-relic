import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  EMPTY_AI_USAGE,
  addDailyAiUsage,
  clearAiUsageLedger,
  estimateAiUsageUsd,
  resolveAiUsageLedger,
  usageForCurrentMonth,
  usageForCurrentWeek,
  writeAiUsageLedger,
} from "./ai-cost";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

describe("AI usage and estimated cost", () => {
  it("calculates all text, audio, cached, and transcription components", () => {
    expect(estimateAiUsageUsd({
      textInputTokens: 1_000_000,
      cachedTextInputTokens: 1_000_000,
      audioInputTokens: 1_000_000,
      cachedAudioInputTokens: 1_000_000,
      textOutputTokens: 1_000_000,
      transcriptionAudioInputTokens: 1_000_000,
      transcriptionTextOutputTokens: 1_000_000,
    })).toBeCloseTo(59.05, 5);
  });

  it("aggregates usage by local date and bounds the ledger", () => {
    const ledger = addDailyAiUsage([], new Date(2026, 7, 1, 12), {
      ...EMPTY_AI_USAGE,
      audioInputTokens: 10,
    });
    const updated = addDailyAiUsage(ledger, new Date(2026, 7, 1, 18), {
      ...EMPTY_AI_USAGE,
      audioInputTokens: 5,
    });
    expect(updated).toEqual([{
      date: "2026-08-01",
      usage: { ...EMPTY_AI_USAGE, audioInputTokens: 15 },
    }]);
  });

  it("uses Monday for the current week and day one for the month", () => {
    const ledger = [
      { date: "2026-07-31", usage: { ...EMPTY_AI_USAGE, textOutputTokens: 1 } },
      { date: "2026-08-01", usage: { ...EMPTY_AI_USAGE, textOutputTokens: 2 } },
      { date: "2026-08-03", usage: { ...EMPTY_AI_USAGE, textOutputTokens: 4 } },
      { date: "2026-08-05", usage: { ...EMPTY_AI_USAGE, textOutputTokens: 8 } },
    ];
    const now = new Date(2026, 7, 5, 12);
    expect(usageForCurrentWeek(ledger, now).textOutputTokens).toBe(12);
    expect(usageForCurrentMonth(ledger, now).textOutputTokens).toBe(14);
  });

  it("persists and clears a validated local ledger", async () => {
    const storage = new TestStorage();
    const ledger = addDailyAiUsage([], new Date(2026, 7, 1, 12), {
      ...EMPTY_AI_USAGE,
      textOutputTokens: 7,
    });
    await expect(writeAiUsageLedger(storage, ledger)).resolves.toBe(true);
    await expect(resolveAiUsageLedger(storage)).resolves.toEqual(ledger);
    await expect(clearAiUsageLedger(storage)).resolves.toBe(true);
    await expect(resolveAiUsageLedger(storage)).resolves.toEqual([]);
  });
});
