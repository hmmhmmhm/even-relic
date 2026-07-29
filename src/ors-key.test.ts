import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  clearOrsKey,
  maskOrsKey,
  orsHeaders,
  resolveOrsKey,
  validateOrsKey,
  writeOrsKey,
} from "./ors-key";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];

  async getLocalStorage(key: string): Promise<string> {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    this.values.set(key, value);
    return true;
  }
}

describe("ORS key helpers", () => {
  it("validates printable trimmed keys without exposing them", () => {
    expect(validateOrsKey("")).toEqual({ ok: false, code: "empty" });
    expect(validateOrsKey("short")).toEqual({ ok: false, code: "length" });
    expect(validateOrsKey("abcdefghijklmnop")).toEqual({
      ok: true,
      value: "abcdefghijklmnop",
    });
    expect(maskOrsKey("abcdefghijklmnop")).toBe("abcd••••mnop");
    expect(orsHeaders("abcdefghijklmnop")).toEqual({
      "x-sandevistan-ors-key": "abcdefghijklmnop",
    });
  });

  it("stores and clears the key through its separate cache entry", async () => {
    const storage = new TestStorage();
    await expect(writeOrsKey(storage, "abcdefghijklmnop")).resolves.toBe(true);
    await expect(resolveOrsKey(storage)).resolves.toBe("abcdefghijklmnop");
    await expect(clearOrsKey(storage)).resolves.toBe(true);
    await expect(resolveOrsKey(storage)).resolves.toBeUndefined();
    expect(storage.writes.map(([key]) => key)).toEqual([
      "sandevistan:ors-key:v1",
      "sandevistan:ors-key:v1",
    ]);
  });
});
