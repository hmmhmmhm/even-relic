import { describe, expect, it } from "vitest";
import {
  createConversateSnapshot,
  DEFAULT_CONVERSATE_SETTINGS,
  normalizeConversateSettings,
} from "./conversate-state";

describe("Conversate settings", () => {
  it("defaults every requested feature on and bounds editable values", () => {
    expect(DEFAULT_CONVERSATE_SETTINGS).toMatchObject({
      transcription: true, translation: true, inform: true, prepNote: true, copilot: true,
    });
    expect(normalizeConversateSettings({
      informSeconds: 200,
      goal: `  ${"x".repeat(600)}  `,
      prepNoteText: " note ",
      spokenLanguages: " ko, en ",
      transcriptionKeywords: " Sandevistan, G2 ",
    })).toMatchObject({ informSeconds: 60, prepNoteText: "note" });
    expect(normalizeConversateSettings({ goal: "x".repeat(600) }).goal).toHaveLength(500);
    expect(normalizeConversateSettings({ transcription: false }).transcription).toBe(true);
    expect(createConversateSnapshot()).toMatchObject({
      transcriptOffset: 0, copilotOpen: false,
    });
  });
});
