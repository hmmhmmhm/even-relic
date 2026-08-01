import { describe, expect, it } from "vitest";
import { createAiTranscriptLines } from "./ai-transcript";

describe("Ask AI transcript lines", () => {
  it("returns one chronological stream of wrapped role lines", () => {
    expect(createAiTranscriptLines(
      [{ user: "Earlier question", assistant: "Earlier answer" }],
      { user: "Current question", assistant: "Current answer" },
    )).toEqual([
      "YOU // Earlier question",
      "AI // Earlier answer",
      "YOU // Current question",
      "AI // Current answer",
    ]);
  });

  it("wraps long answers without grouping them into six-line pages", () => {
    const lines = createAiTranscriptLines(
      [],
      {
        user: "Question",
        assistant: "streaming response ".repeat(80),
      },
    );

    expect(lines[0]).toBe("YOU // Question");
    expect(lines[1]).toContain("AI // streaming response");
    expect(lines.length).toBeGreaterThan(6);
    expect(lines.every((line) => !line.includes("\n"))).toBe(true);
  });

  it("ignores an empty live turn", () => {
    expect(createAiTranscriptLines(
      [{ user: "Hello", assistant: "Hi" }],
      { user: "  ", assistant: "" },
    )).toEqual([
      "YOU // Hello",
      "AI // Hi",
    ]);
  });
});
