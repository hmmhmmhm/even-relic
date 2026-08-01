import { describe, expect, it } from "vitest";
import {
  getAdjacentFastHudPage,
  getFastHudPages,
  normalizeFastHudPage,
} from "./fast-hud-pages";

describe("Fast Canvas page model", () => {
  it("adds Ask AI as the final keyless page", () => {
    expect(getFastHudPages("disabled")).toEqual([
      "overview",
      "news",
      "todo",
      "weather",
      "ai",
    ]);
    expect(getAdjacentFastHudPage(
      "ai",
      "next",
      "disabled",
    )).toBe("overview");
    expect(getAdjacentFastHudPage(
      "overview",
      "previous",
      "disabled",
    )).toBe("ai");
  });

  it("adds Navigation last whenever routing is enabled", () => {
    expect(getFastHudPages("fresh")).toEqual([
      "overview",
      "news",
      "todo",
      "weather",
      "ai",
      "navigation",
    ]);
    expect(getAdjacentFastHudPage(
      "weather",
      "next",
      "fresh",
    )).toBe("ai");
    expect(getAdjacentFastHudPage(
      "ai",
      "next",
      "fresh",
    )).toBe("navigation");
  });

  it("normalizes a removed Navigation page to Weather", () => {
    expect(normalizeFastHudPage("navigation", "disabled")).toBe("weather");
    expect(normalizeFastHudPage("news", "disabled")).toBe("news");
  });

  it("uses a saved order and skips disabled pages", () => {
    const layout = {
      order: ["overview", "weather", "news", "todo", "ai"],
      enabled: ["overview", "weather", "todo", "ai"],
    } as const;

    expect(getFastHudPages("disabled", layout)).toEqual([
      "overview",
      "weather",
      "todo",
      "ai",
    ]);
    expect(getAdjacentFastHudPage(
      "overview",
      "next",
      "disabled",
      layout,
    )).toBe("weather");
  });

  it("does not expose Navigation while routing is disabled", () => {
    const layout = {
      order: ["overview", "navigation", "news", "todo", "weather", "ai"],
      enabled: ["overview", "navigation", "news"],
    } as const;

    expect(getFastHudPages("disabled", layout)).toEqual([
      "overview",
      "news",
    ]);
  });
});
