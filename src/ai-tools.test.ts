import { describe, expect, it, vi } from "vitest";
import { executeBuiltinAiTool } from "./ai-tools";

const now = new Date("2026-08-02T12:34:56.000+09:00");

describe("Ask AI built-in tools", () => {
  it("returns an exact localized time without network access", async () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const offsetMinutes = -now.getTimezoneOffset();
    const offset = `${offsetMinutes >= 0 ? "+" : "-"}`
      + `${String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0")}`
      + `:${String(Math.abs(offsetMinutes) % 60).padStart(2, "0")}`;
    const result = await executeBuiltinAiTool("get_current_time", "{}", {
      locale: "ko",
      now: () => now,
      getLocation: () => ({ status: "unavailable" }),
      searchWeb: vi.fn(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected time result");
    expect(result.data).toMatchObject({
      iso: now.toISOString(),
      timezone,
      utcOffset: offset,
    });
  });

  it("returns exact live GPS only when current and rejects demo/cache data", async () => {
    const live = await executeBuiltinAiTool("get_current_location", "{}", {
      locale: "en",
      now: () => now,
      getLocation: () => ({
        status: "fresh",
        fetchedAt: now.getTime() - 1_000,
        value: {
          coordinate: { latitude: 37.5, longitude: 127.01 },
          source: "live",
          accuracy: 4.2,
          heading: 180,
          speed: 1.5,
        },
      }),
      searchWeb: vi.fn(),
    });
    expect(live).toMatchObject({
      ok: true,
      data: { latitude: 37.5, longitude: 127.01, accuracyMeters: 4.2 },
    });

    const demo = await executeBuiltinAiTool("get_current_location", "{}", {
      locale: "en",
      now: () => now,
      getLocation: () => ({
        status: "fresh",
        fetchedAt: now.getTime(),
        value: {
          coordinate: { latitude: 37.5, longitude: 127.01 },
          source: "demo",
        },
      }),
      searchWeb: vi.fn(),
    });
    expect(demo).toEqual({
      ok: false,
      error: { code: "LOCATION_UNAVAILABLE", message: "Live GPS is unavailable" },
    });
  });

  it("bounds web search queries and returns citations and usage", async () => {
    const searchWeb = vi.fn().mockResolvedValue({
      answer: "Grounded answer [1]",
      sources: [{ title: "Source", url: "https://example.com/a" }],
      usage: { inputTokens: 12, outputTokens: 8, webSearchCalls: 1 },
    });
    const result = await executeBuiltinAiTool(
      "search_web",
      JSON.stringify({ query: "latest Even Realities firmware" }),
      {
        locale: "en",
        now: () => now,
        getLocation: () => ({ status: "unavailable" }),
        searchWeb,
      },
    );
    expect(searchWeb).toHaveBeenCalledWith(
      "latest Even Realities firmware",
      "en",
    );
    expect(result).toMatchObject({ ok: true, data: { answer: "Grounded answer [1]" } });

    await expect(executeBuiltinAiTool("search_web", "{}", {
      locale: "en",
      now: () => now,
      getLocation: () => ({ status: "unavailable" }),
      searchWeb,
    })).resolves.toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENTS" } });
  });
});
