import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  EMPTY_AI_USAGE,
  addDailyAiUsage,
  clearAiUsageLedger,
  costSummaryForCurrentPeriod,
  estimateAiUsageUsd,
  resolveAiUsageLedger,
  usageForCurrentMonth,
  usageForCurrentWeek,
  writeAiUsageLedger,
} from "./ai-cost";
import { LEGACY_AI_PRICING_VERSION } from "./ai-pricing";

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
      searchTextInputTokens: 1_000_000,
      cachedSearchTextInputTokens: 1_000_000,
      searchTextOutputTokens: 1_000_000,
      webSearchCalls: 1,
    })).toBeCloseTo(61.31, 5);
  });

  it("aggregates usage by local date and bounds the ledger", () => {
    const ledger = addDailyAiUsage([], new Date(2026, 7, 1, 12), {
      ...EMPTY_AI_USAGE,
      audioInputTokens: 10,
    }, { estimatedNanoUsd: 100, unpricedEvents: 0, pricingVersions: ["v1"] });
    const updated = addDailyAiUsage(ledger, new Date(2026, 7, 1, 18), {
      ...EMPTY_AI_USAGE,
      audioInputTokens: 5,
    }, { estimatedNanoUsd: 50, unpricedEvents: 1, pricingVersions: ["v2"] });
    expect(updated).toEqual([{
      date: "2026-08-01",
      usage: { ...EMPTY_AI_USAGE, audioInputTokens: 15 },
      charge: {
        estimatedNanoUsd: 150,
        unpricedEvents: 1,
        pricingVersions: ["v1", "v2"],
      },
    }]);
  });

  it("uses Monday for the current week and day one for the month", () => {
    const charge = { estimatedNanoUsd: 0, unpricedEvents: 0, pricingVersions: [] };
    const ledger = [
      { date: "2026-07-31", usage: { ...EMPTY_AI_USAGE, textOutputTokens: 1 }, charge },
      { date: "2026-08-01", usage: { ...EMPTY_AI_USAGE, textOutputTokens: 2 }, charge },
      { date: "2026-08-03", usage: { ...EMPTY_AI_USAGE, textOutputTokens: 4 }, charge },
      { date: "2026-08-05", usage: { ...EMPTY_AI_USAGE, textOutputTokens: 8 }, charge },
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

  it("migrates legacy ledger entries without reclassifying historical search", async () => {
    const storage = new TestStorage();
    storage.values.set("sandevistan:ai-usage:v1", JSON.stringify([{
      date: "2026-08-01",
      usage: {
        ...EMPTY_AI_USAGE,
        cachedSearchTextInputTokens: undefined,
        searchTextInputTokens: 1_000_000,
        searchTextOutputTokens: 1_000_000,
        webSearchCalls: 1,
      },
    }]));
    const ledger = await resolveAiUsageLedger(storage);
    expect(ledger[0]?.charge.pricingVersions).toEqual([LEGACY_AI_PRICING_VERSION]);
    expect(ledger[0]?.charge.estimatedNanoUsd).toBe(2_260_000_000);
  });

  it("sums immutable event-time costs and reports unpriced events", () => {
    const ledger = [
      {
        date: "2026-08-03",
        usage: EMPTY_AI_USAGE,
        charge: { estimatedNanoUsd: 1_500_000_000, unpricedEvents: 1, pricingVersions: ["v1"] },
      },
      {
        date: "2026-08-05",
        usage: EMPTY_AI_USAGE,
        charge: { estimatedNanoUsd: 500_000_000, unpricedEvents: 0, pricingVersions: ["v2"] },
      },
    ];
    expect(costSummaryForCurrentPeriod(ledger, new Date(2026, 7, 5, 12))).toEqual({
      weekUsd: 2,
      monthUsd: 2,
      hasUnpricedUsage: true,
    });
  });
});
