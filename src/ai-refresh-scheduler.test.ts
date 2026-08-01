import { describe, expect, it, vi } from "vitest";
import { createAiRefreshScheduler } from "./ai-refresh-scheduler";

describe("AI refresh scheduler", () => {
  it("coalesces pending updates and never queues behind a busy attempt", async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const attempt = vi.fn(() => new Promise<void>((resolve) => {
      release = resolve;
    }));
    const scheduler = createAiRefreshScheduler(attempt, 300);
    scheduler.request();
    scheduler.request();
    await vi.advanceTimersByTimeAsync(300);
    expect(attempt).toHaveBeenCalledOnce();
    scheduler.request();
    await vi.advanceTimersByTimeAsync(300);
    expect(attempt).toHaveBeenCalledOnce();
    release?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(600);
    expect(attempt).toHaveBeenCalledOnce();
    scheduler.dispose();
    vi.useRealTimers();
  });

  it("attempts a final update immediately when idle", async () => {
    const attempt = vi.fn(async () => undefined);
    const scheduler = createAiRefreshScheduler(attempt, 300);
    expect(await scheduler.final()).toBe(true);
    expect(attempt).toHaveBeenCalledOnce();
    scheduler.dispose();
  });
});
