import { describe, expect, it, vi } from "vitest";
import { requestAiWebSearch } from "./ai-web-search";

const KEY = "sk-test-1234567890abcdefghijklmnop";

describe("Ask AI web-search client", () => {
  it("accepts bounded model-aware cached usage", async () => {
    const fetchImpl = vi.fn(async () => Response.json({
      answer: "Grounded answer",
      sources: [],
      usage: {
        model: "gpt-5.5-2026-07-01",
        inputTokens: 100,
        cachedInputTokens: 20,
        outputTokens: 30,
        webSearchCalls: 1,
      },
    }));
    await expect(requestAiWebSearch({
      key: KEY,
      query: "current facts",
      locale: "en",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toMatchObject({
      usage: { model: "gpt-5.5-2026-07-01", cachedInputTokens: 20 },
    });
  });

  it.each([
    { model: "", inputTokens: 10, cachedInputTokens: 0 },
    { model: "x".repeat(121), inputTokens: 10, cachedInputTokens: 0 },
    { model: "gpt-5.5", inputTokens: 10, cachedInputTokens: 11 },
  ])("rejects invalid usage envelope %#", async (invalid) => {
    const fetchImpl = vi.fn(async () => Response.json({
      answer: "Grounded answer",
      sources: [],
      usage: { ...invalid, outputTokens: 1, webSearchCalls: 1 },
    }));
    await expect(requestAiWebSearch({
      key: KEY,
      query: "current facts",
      locale: "en",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).rejects.toThrow("Web search failed");
  });
});
