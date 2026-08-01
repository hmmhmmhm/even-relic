import { describe, expect, it } from "vitest";
import { createAiTranscriptPages } from "./ai-transcript";

describe("Ask AI transcript pages", () => {
  it("packs both roles into one chronological page when they fit", () => {
    expect(createAiTranscriptPages(
      [],
      { user: "Hello", assistant: "Hello. How can I help?" },
    )).toEqual([
      "YOU // Hello\nAI // Hello. How can I help?",
    ]);
  });

  it("keeps lines chronological and limits every page to six lines", () => {
    const pages = createAiTranscriptPages(
      [{ user: "Earlier question", assistant: "Earlier answer" }],
      {
        user: "Current question",
        assistant: "streaming response ".repeat(80),
      },
    );
    const transcript = pages.join("\n");

    expect(transcript.indexOf("Earlier question"))
      .toBeLessThan(transcript.indexOf("Current question"));
    expect(transcript).toContain("AI // streaming response");
    for (const page of pages) {
      expect(page.split("\n").length).toBeLessThanOrEqual(6);
    }
  });

  it("starts a short new turn on a fresh page rather than splitting its roles", () => {
    const pages = createAiTranscriptPages(
      [{
        user: "Earlier question",
        assistant: "earlier answer ".repeat(9),
      }],
      { user: "Current question", assistant: "Current answer" },
    );
    const currentPage = pages.find((page) => page.includes("Current question"));

    expect(currentPage).toContain("YOU // Current question");
    expect(currentPage).toContain("AI // Current answer");
  });
});
