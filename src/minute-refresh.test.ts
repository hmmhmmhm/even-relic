import { describe, expect, it, vi } from "vitest";
import { startMinuteRefresh } from "./minute-refresh";

describe("minute refresh scheduler", () => {
  it("emits at most once when the SDK repeats a callback in one minute", () => {
    let now = Date.parse("2026-07-28T08:03:00.345Z");
    let tick: (() => void) | undefined;
    const setIntervalImpl = vi.fn((callback: () => void) => {
      tick = callback;
      return 9;
    });
    const clearIntervalImpl = vi.fn();
    const onMinute = vi.fn();
    const stop = startMinuteRefresh(onMinute, {
      now: () => now,
      setIntervalImpl,
      clearIntervalImpl,
    });

    for (let index = 0; index < 20_000; index += 1) tick?.();
    expect(onMinute).not.toHaveBeenCalled();
    expect(setIntervalImpl).toHaveBeenCalledOnce();

    now += 60_000;
    for (let index = 0; index < 20_000; index += 1) tick?.();
    expect(onMinute).toHaveBeenCalledOnce();
    expect(onMinute).toHaveBeenCalledWith(
      Math.floor(now / 60_000),
    );

    stop();
    stop();
    expect(clearIntervalImpl).toHaveBeenCalledOnce();
    expect(clearIntervalImpl).toHaveBeenCalledWith(9);
  });

  it("does not replay every skipped minute after a wall-clock jump", () => {
    let now = Date.parse("2026-07-28T08:03:10.000Z");
    let tick: (() => void) | undefined;
    const onMinute = vi.fn();
    startMinuteRefresh(onMinute, {
      now: () => now,
      setIntervalImpl: (callback) => {
        tick = callback;
        return 10;
      },
      clearIntervalImpl: vi.fn(),
    });

    now += 10 * 60_000;
    tick?.();
    tick?.();

    expect(onMinute).toHaveBeenCalledOnce();
    expect(onMinute).toHaveBeenCalledWith(Math.floor(now / 60_000));
  });
});
