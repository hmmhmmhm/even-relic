import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  type AiConversationExcerpt,
  appendAiConversationExcerpt,
  clearAiConversationHistory,
  resolveAiConversationHistory,
  writeAiConversationHistory,
} from "./ai-history";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

describe("AI conversation excerpts", () => {
  it("keeps only three newest bounded excerpts", () => {
    let history: readonly AiConversationExcerpt[] = [];
    for (let index = 0; index < 5; index += 1) {
      history = appendAiConversationExcerpt(history, {
        id: `session-${index}`,
        endedAt: `2026-08-0${index + 1}T00:00:00.000Z`,
        user: ` User ${index} ${"u".repeat(300)} `,
        assistant: ` Answer ${index} ${"a".repeat(300)} `,
      });
    }
    expect(history.map(({ id }) => id)).toEqual([
      "session-4",
      "session-3",
      "session-2",
    ]);
    expect(history[0].user.length).toBeLessThanOrEqual(160);
    expect(history[0].assistant.length).toBeLessThanOrEqual(160);
  });

  it("persists and clears local excerpts", async () => {
    const storage = new TestStorage();
    const history = appendAiConversationExcerpt([], {
      id: "session-1",
      endedAt: "2026-08-01T00:00:00.000Z",
      user: "Hello",
      assistant: "Hi",
    });
    await expect(writeAiConversationHistory(storage, history)).resolves.toBe(true);
    await expect(resolveAiConversationHistory(storage)).resolves.toEqual(history);
    await expect(clearAiConversationHistory(storage)).resolves.toBe(true);
    await expect(resolveAiConversationHistory(storage)).resolves.toEqual([]);
  });
});
