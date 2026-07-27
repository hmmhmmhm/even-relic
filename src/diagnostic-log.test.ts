import { describe, expect, it, vi } from "vitest";
import {
  createDiagnosticLogger,
  startDiagnosticHeartbeat,
} from "./diagnostic-log";

describe("diagnostic log", () => {
  it("formats timestamped entries and keeps only the newest capacity", () => {
    const times = [
      new Date("2026-07-27T22:31:08.427+09:00"),
      new Date("2026-07-27T22:31:09.004+09:00"),
      new Date("2026-07-27T22:31:10.111+09:00"),
    ];
    const logger = createDiagnosticLogger({
      capacity: 2,
      now: () => times.shift()!,
    });

    logger.append("APP", "first");
    logger.append("TILE", "second", 18);
    logger.append("ERROR", "third");

    expect(logger.snapshot()).toMatchObject({
      dropped: 1,
      entries: [
        { sequence: 2, timestamp: "22:31:09.004", category: "TILE" },
        { sequence: 3, timestamp: "22:31:10.111", category: "ERROR" },
      ],
    });
    expect(logger.text()).toContain(
      "[22:31:09.004] #0002 [TILE] second · 18ms",
    );
  });

  it("clears retained and dropped entries without reusing sequence numbers", () => {
    const logger = createDiagnosticLogger({ capacity: 1 });
    logger.append("APP", "one");
    logger.append("APP", "two");
    logger.clear();
    logger.append("APP", "three");

    expect(logger.snapshot()).toMatchObject({
      dropped: 0,
      entries: [{ sequence: 3, message: "three" }],
    });
  });

  it("reports heartbeat drift and stops its timer", () => {
    vi.useFakeTimers();
    let now = 1_000;
    const logger = createDiagnosticLogger();
    const stop = startDiagnosticHeartbeat(logger, {
      intervalMs: 5_000,
      now: () => now,
    });

    now = 6_125;
    vi.advanceTimersByTime(5_000);
    expect(logger.text()).toContain("heartbeat · drift 125ms");

    stop();
    now = 11_125;
    vi.advanceTimersByTime(5_000);
    expect(logger.snapshot().entries).toHaveLength(1);
    vi.useRealTimers();
  });
});
