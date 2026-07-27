import { describe, expect, it } from "vitest";
import { wrapHudText } from "./fast-detail-text";

describe("wrapHudText", () => {
  it("wraps Korean by display units and marks truncated final content", () => {
    expect(wrapHudText("가나다라마바사", 6, 2)).toEqual([
      "가나다",
      "라마…",
    ]);
  });

  it("prefers word boundaries for English", () => {
    expect(wrapHudText("alpha beta gamma", 10, 2)).toEqual([
      "alpha beta",
      "gamma",
    ]);
  });

  it("normalizes whitespace and handles mixed or oversized words", () => {
    expect(wrapHudText("  서울역   alpha역  ", 8, 3)).toEqual([
      "서울역",
      "alpha역",
    ]);
    expect(wrapHudText("abcdefghijk", 5, 3)).toEqual([
      "abcde",
      "fghij",
      "k",
    ]);
  });

  it("returns no lines for empty text or unusable limits", () => {
    expect(wrapHudText("", 10, 2)).toEqual([]);
    expect(wrapHudText("내용", 0, 2)).toEqual([]);
    expect(wrapHudText("내용", 10, 0)).toEqual([]);
  });
});
