import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  OPENAI_KEY_HEADER,
  clearOpenAiKey,
  maskOpenAiKey,
  openAiKeyHeaders,
  resolveOpenAiKey,
  validateOpenAiKey,
  writeOpenAiKey,
} from "./openai-key";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();

  async getLocalStorage(key: string): Promise<string> {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.values.set(key, value);
    return true;
  }
}

const KEY = "sk-test-1234567890abcdefghijklmnop";

describe("OpenAI BYOK helpers", () => {
  it("accepts only plausible printable secret keys", () => {
    expect(validateOpenAiKey("")).toEqual({ ok: false, code: "empty" });
    expect(validateOpenAiKey("not-a-key")).toEqual({
      ok: false,
      code: "format",
    });
    expect(validateOpenAiKey(`${KEY}\n`).ok).toBe(true);
    expect(validateOpenAiKey(`sk-test-${"a".repeat(4_100)}`)).toEqual({
      ok: false,
      code: "length",
    });
    expect(validateOpenAiKey("sk-test-1234567890\u0000abcdefghijklmnop"))
      .toEqual({ ok: false, code: "characters" });
  });

  it("masks and transports a key without putting it in URLs", () => {
    expect(maskOpenAiKey(KEY)).toBe("sk-t••••mnop");
    expect(openAiKeyHeaders(KEY)).toEqual({ [OPENAI_KEY_HEADER]: KEY });
  });

  it("stores and clears the key in its own Even storage entry", async () => {
    const storage = new TestStorage();
    await expect(writeOpenAiKey(storage, KEY)).resolves.toBe(true);
    await expect(resolveOpenAiKey(storage)).resolves.toBe(KEY);
    await expect(clearOpenAiKey(storage)).resolves.toBe(true);
    await expect(resolveOpenAiKey(storage)).resolves.toBeUndefined();
    expect([...storage.values.keys()]).toEqual([
      "sandevistan:openai-key:v1",
    ]);
  });
});
