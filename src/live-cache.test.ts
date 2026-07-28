import { describe, expect, it } from "vitest";
import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";
import { diagnosticLogger } from "./diagnostic-log";

class MemoryStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  readonly reads: string[] = [];
  readonly writes: Array<[string, string]> = [];

  async getLocalStorage(key: string): Promise<string> {
    this.reads.push(key);
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    this.values.set(key, value);
    return true;
  }
}

describe("live cache", () => {
  it("round trips JSON through the versioned key", async () => {
    const storage = new MemoryStorage();
    const value = { temperatureC: 28, condition: "맑음" };
    const isWeatherCache = (candidate: unknown): candidate is typeof value =>
      typeof candidate === "object" &&
      candidate !== null &&
      "temperatureC" in candidate &&
      "condition" in candidate;

    expect(await writeCache(storage, "weather", value)).toBe(true);
    expect(storage.writes).toEqual([
      ["sandevistan:weather:v1", JSON.stringify(value)],
    ]);

    expect(
      await readCache(storage, "weather", isWeatherCache),
    ).toEqual(value);
    expect(storage.reads).toEqual(["sandevistan:weather:v1"]);
  });

  it("returns undefined when the cache is absent, malformed, or invalid", async () => {
    const storage = new MemoryStorage();
    const isObject = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null;

    expect(await readCache(storage, "missing", isObject)).toBeUndefined();

    storage.values.set("sandevistan:news:v1", "{not-json");
    await expect(readCache(storage, "news", isObject)).resolves.toBeUndefined();

    storage.values.set("sandevistan:weather:v1", JSON.stringify("not an object"));
    await expect(
      readCache(storage, "weather", isObject),
    ).resolves.toBeUndefined();
  });

  it("returns undefined instead of throwing when a read fails", async () => {
    const storage: EvenStorage = {
      getLocalStorage: async () => {
        throw new Error("read failed");
      },
      setLocalStorage: async () => true,
    };
    const acceptsAny = (_value: unknown): _value is unknown => true;

    await expect(
      readCache(storage, "weather", acceptsAny),
    ).resolves.toBeUndefined();
  });

  it("returns false instead of throwing when a write fails", async () => {
    const storage: EvenStorage = {
      getLocalStorage: async () => "",
      setLocalStorage: async () => {
        throw new Error("write failed");
      },
    };

    await expect(writeCache(storage, "weather", { value: 1 })).resolves.toBe(
      false,
    );
  });

  it("clears a cache entry by writing an empty string", async () => {
    const storage = new MemoryStorage();
    storage.values.set("sandevistan:weather:v1", "cached");

    expect(await clearCache(storage, "weather")).toBe(true);
    expect(storage.writes).toEqual([["sandevistan:weather:v1", ""]]);
    await expect(
      readCache(storage, "weather", (_value): _value is unknown => true),
    ).resolves.toBeUndefined();
  });

  it("traces storage outcomes without logging stored values", async () => {
    const storage = new MemoryStorage();
    diagnosticLogger.clear();

    await writeCache(storage, "weather", {
      privatePayload: "37.55645,126.922",
    });
    await readCache(
      storage,
      "weather",
      (value): value is Record<string, unknown> => Boolean(value),
    );
    await clearCache(storage, "weather");

    const trace = diagnosticLogger.text();
    expect(trace).toContain("[STORAGE] write weather start");
    expect(trace).toContain("[STORAGE] write weather success");
    expect(trace).toContain("[STORAGE] read weather hit");
    expect(trace).toContain("[STORAGE] clear weather success");
    expect(trace).not.toContain("privatePayload");
    expect(trace).not.toContain("37.55645");
    expect(trace).not.toContain("126.922");
  });

  it("returns false instead of throwing when clear fails", async () => {
    const storage: EvenStorage = {
      getLocalStorage: async () => "",
      setLocalStorage: async () => {
        throw new Error("clear failed");
      },
    };

    await expect(clearCache(storage, "weather")).resolves.toBe(false);
  });
});
