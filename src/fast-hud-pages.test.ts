import { describe, expect, it } from "vitest";
import {
  getAdjacentFastHudPage,
  getFastHudPages,
  normalizeFastHudPage,
} from "./fast-hud-pages";

describe("Fast Canvas page model", () => {
  it("uses Weather as the fourth and final keyless page", () => {
    expect(getFastHudPages("disabled")).toEqual([
      "overview",
      "news",
      "todo",
      "weather",
    ]);
    expect(getAdjacentFastHudPage(
      "weather",
      "next",
      "disabled",
    )).toBe("overview");
    expect(getAdjacentFastHudPage(
      "overview",
      "previous",
      "disabled",
    )).toBe("weather");
  });

  it("adds Navigation last whenever routing is enabled", () => {
    expect(getFastHudPages("fresh")).toEqual([
      "overview",
      "news",
      "todo",
      "weather",
      "navigation",
    ]);
    expect(getAdjacentFastHudPage(
      "weather",
      "next",
      "fresh",
    )).toBe("navigation");
  });

  it("normalizes a removed Navigation page to Weather", () => {
    expect(normalizeFastHudPage("navigation", "disabled")).toBe("weather");
    expect(normalizeFastHudPage("news", "disabled")).toBe("news");
  });
});
