import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";

export type AiUsage = {
  readonly textInputTokens: number;
  readonly cachedTextInputTokens: number;
  readonly audioInputTokens: number;
  readonly cachedAudioInputTokens: number;
  readonly textOutputTokens: number;
  readonly transcriptionAudioInputTokens: number;
  readonly transcriptionTextOutputTokens: number;
};

export type AiDailyUsage = {
  readonly date: string;
  readonly usage: AiUsage;
};

export const EMPTY_AI_USAGE: AiUsage = {
  textInputTokens: 0,
  cachedTextInputTokens: 0,
  audioInputTokens: 0,
  cachedAudioInputTokens: 0,
  textOutputTokens: 0,
  transcriptionAudioInputTokens: 0,
  transcriptionTextOutputTokens: 0,
};

const PRICE_PER_MILLION = {
  textInputTokens: 4,
  cachedTextInputTokens: 0.4,
  audioInputTokens: 32,
  cachedAudioInputTokens: 0.4,
  textOutputTokens: 16,
  transcriptionAudioInputTokens: 1.25,
  transcriptionTextOutputTokens: 5,
} as const satisfies Record<keyof AiUsage, number>;

function safeTokenCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function addAiUsage(left: AiUsage, right: AiUsage): AiUsage {
  return Object.fromEntries(
    (Object.keys(EMPTY_AI_USAGE) as Array<keyof AiUsage>).map((key) => [
      key,
      safeTokenCount(left[key]) + safeTokenCount(right[key]),
    ]),
  ) as unknown as AiUsage;
}

export function estimateAiUsageUsd(usage: AiUsage): number {
  return (Object.keys(PRICE_PER_MILLION) as Array<keyof AiUsage>)
    .reduce(
      (total, key) => total
        + safeTokenCount(usage[key]) * PRICE_PER_MILLION[key] / 1_000_000,
      0,
    );
}

function localDateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addDailyAiUsage(
  ledger: readonly AiDailyUsage[],
  at: Date,
  usage: AiUsage,
): readonly AiDailyUsage[] {
  const date = localDateKey(at);
  const previous = ledger.find((entry) => entry.date === date)?.usage
    ?? EMPTY_AI_USAGE;
  return [
    ...ledger.filter((entry) => entry.date !== date),
    { date, usage: addAiUsage(previous, usage) },
  ].sort((left, right) => left.date.localeCompare(right.date)).slice(-400);
}

function usageInRange(
  ledger: readonly AiDailyUsage[],
  start: Date,
  end: Date,
): AiUsage {
  const startKey = localDateKey(start);
  const endKey = localDateKey(end);
  return ledger.reduce(
    (total, entry) => entry.date >= startKey && entry.date <= endKey
      ? addAiUsage(total, entry.usage)
      : total,
    EMPTY_AI_USAGE,
  );
}

export function usageForCurrentWeek(
  ledger: readonly AiDailyUsage[],
  now = new Date(),
): AiUsage {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return usageInRange(ledger, start, now);
}

export function usageForCurrentMonth(
  ledger: readonly AiDailyUsage[],
  now = new Date(),
): AiUsage {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return usageInRange(ledger, start, now);
}

function isUsage(value: unknown): value is AiUsage {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (Object.keys(EMPTY_AI_USAGE) as Array<keyof AiUsage>).every(
    (key) => typeof item[key] === "number"
      && Number.isFinite(item[key])
      && (item[key] as number) >= 0,
  );
}

function isUsageLedger(value: unknown): value is readonly AiDailyUsage[] {
  return Array.isArray(value)
    && value.length <= 400
    && value.every((entry) => (
      typeof entry === "object"
      && entry !== null
      && typeof entry.date === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      && isUsage(entry.usage)
    ));
}

export async function resolveAiUsageLedger(
  storage: EvenStorage,
): Promise<readonly AiDailyUsage[]> {
  return await readCache(storage, "ai-usage", isUsageLedger) ?? [];
}

export function writeAiUsageLedger(
  storage: EvenStorage,
  ledger: readonly AiDailyUsage[],
): Promise<boolean> {
  return writeCache(storage, "ai-usage", ledger.slice(-400));
}

export function clearAiUsageLedger(storage: EvenStorage): Promise<boolean> {
  return clearCache(storage, "ai-usage");
}
