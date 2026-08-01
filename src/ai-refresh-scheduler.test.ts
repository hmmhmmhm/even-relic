import { describe, expect, it, vi } from "vitest";
import { createAiRefreshScheduler } from "./ai-refresh-scheduler";

describe("AI refresh scheduler", () => {
  it("samples continuous deltas at a fixed cadence instead of waiting for silence", async () => {
    vi.useFakeTimers();
    const attempt = vi.fn(async () => undefined);
    const scheduler = createAiRefreshScheduler(attempt, 100);

    scheduler.request();
    await vi.advanceTimersByTimeAsync(50);
    scheduler.request();
    await vi.advanceTimersByTimeAsync(50);
    expect(attempt).toHaveBeenCalledOnce();

    scheduler.request();
    await vi.advanceTimersByTimeAsync(100);
    expect(attempt).toHaveBeenCalledTimes(2);
    scheduler.dispose();
  });

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

  it("performs one terminal refresh after an active sampled update", async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const attempt = vi.fn(() => {
      if (attempt.mock.calls.length > 1) return Promise.resolve();
      return new Promise<void>((resolve) => { release = resolve; });
    });
    const scheduler = createAiRefreshScheduler(attempt, 100);

    scheduler.request();
    await vi.advanceTimersByTimeAsync(100);
    expect(attempt).toHaveBeenCalledOnce();
    const final = scheduler.final();
    expect(attempt).toHaveBeenCalledOnce();
    release?.();
    expect(await final).toBe(true);
    expect(attempt).toHaveBeenCalledTimes(2);
    scheduler.dispose();
  });
});
