import { describe, expect, it, vi } from "vitest";
import { runBounded } from "./bounded-task-pool";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((pass, fail) => {
    resolve = pass;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe("runBounded", () => {
  it("starts in order and fills one freed slot", async () => {
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const starts: number[] = [];
    let active = 0;
    let maximum = 0;
    const running = runBounded(gates, 2, async (gate, index) => {
      starts.push(index);
      active += 1;
      maximum = Math.max(maximum, active);
      await gate.promise;
      active -= 1;
    });

    await vi.waitFor(() => expect(starts).toEqual([0, 1]));
    gates[1].resolve();
    await vi.waitFor(() => expect(starts).toEqual([0, 1, 2]));
    gates[0].resolve();
    gates[2].resolve();
    await vi.waitFor(() => expect(starts).toEqual([0, 1, 2, 3]));
    gates[3].resolve();
    await running;
    expect(maximum).toBe(2);
  });

  it("stops launching after failure and settles active work", async () => {
    const gates = [deferred(), deferred(), deferred()];
    const starts: number[] = [];
    const running = runBounded(gates, 2, async (gate, index) => {
      starts.push(index);
      await gate.promise;
    });
    let settled = false;
    const observed = running.catch((error: unknown) => {
      settled = true;
      throw error;
    });

    await vi.waitFor(() => expect(starts).toEqual([0, 1]));
    gates[0].reject(new Error("send failed"));
    await Promise.resolve();
    expect(starts).toEqual([0, 1]);
    expect(settled).toBe(false);
    gates[1].resolve();
    await expect(observed).rejects.toThrow("send failed");
    expect(starts).toEqual([0, 1]);
  });

  it.each([
    [1, 1],
    [3, 3],
  ])("enforces limit %i", async (limit, expectedMaximum) => {
    let active = 0;
    let maximum = 0;

    await runBounded([0, 1, 2, 3], limit, async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
    });

    expect(maximum).toBe(expectedMaximum);
  });
});
