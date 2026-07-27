import { describe, expect, it, vi } from "vitest";
import {
  millisecondsUntilNextMinute,
  startMinuteRefresh,
} from "./minute-refresh";

describe("minute refresh scheduler", () => {
  it("aligns to the next minute instead of drifting from startup", () => {
    expect(millisecondsUntilNextMinute(
      Date.parse("2026-07-27T14:37:42.250Z"),
    )).toBe(17_750);
    expect(millisecondsUntilNextMinute(
      Date.parse("2026-07-27T14:38:00.000Z"),
    )).toBe(60_000);
  });

  it("realigns each tick and cancels the pending timeout", () => {
    let now = Date.parse("2026-07-27T14:37:42.250Z");
    let callback: (() => void) | undefined;
    const setTimeoutImpl = vi.fn((next: () => void) => {
      callback = next;
      return 7;
    });
    const clearTimeoutImpl = vi.fn();
    const onMinute = vi.fn();
    const stop = startMinuteRefresh(onMinute, {
      now: () => now,
      setTimeoutImpl,
      clearTimeoutImpl,
    });

    expect(setTimeoutImpl).toHaveBeenLastCalledWith(
      expect.any(Function),
      17_750,
    );
    now = Date.parse("2026-07-27T14:38:00.125Z");
    callback?.();
    expect(onMinute).toHaveBeenCalledOnce();
    expect(setTimeoutImpl).toHaveBeenLastCalledWith(
      expect.any(Function),
      59_875,
    );

    stop();
    expect(clearTimeoutImpl).toHaveBeenCalledWith(7);
  });
});
