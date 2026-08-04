import { describe, expect, it, vi } from "vitest";
import { RebuildPageContainer } from "@evenrealities/even_hub_sdk";
import { createConversateSnapshot, DEFAULT_CONVERSATE_SETTINGS } from "./conversate-state";
import { createNativeConversateContent, createNativeConversateMode } from "./native-conversate-text";

describe("native Conversate text page", () => {
  it("reserves a bordered Inform region above an event-capturing conversation region", async () => {
    const pages: RebuildPageContainer[] = [];
    const rebuildPageContainer = vi.fn(async (page: RebuildPageContainer) => {
      pages.push(page);
      return true;
    });
    const mode = createNativeConversateMode({
      bridge: { rebuildPageContainer, textContainerUpgrade: vi.fn(async () => true) },
      createImagePage: () => new RebuildPageContainer({ containerTotalNum: 0 }),
    });
    await mode.enter({ inform: "Correction", body: "Live transcript" });
    const page = pages[0];
    expect(page).toBeDefined();
    if (!page) return;
    expect(page.containerTotalNum).toBe(2);
    expect(page.textObject).toEqual([
      expect.objectContaining({ containerName: "conversateInform", borderWidth: 1, content: "Correction" }),
      expect.objectContaining({ containerName: "conversateBody", isEventCapture: 1, content: "Live transcript" }),
    ]);
  });

  it("uses SDK-safe blank text when entering or clearing an empty region", async () => {
    const upgrades: unknown[] = [];
    const rebuildPageContainer = vi.fn(async (_page: RebuildPageContainer) => true);
    const mode = createNativeConversateMode({
      bridge: {
        rebuildPageContainer,
        textContainerUpgrade: vi.fn(async (update) => { upgrades.push(update); return true; }),
      },
      createImagePage: () => new RebuildPageContainer({ containerTotalNum: 0 }),
    });
    await mode.enter({ inform: "", body: "" });
    expect(rebuildPageContainer.mock.calls[0]?.[0].textObject).toEqual([
      expect.objectContaining({ containerName: "conversateInform", content: " " }),
      expect.objectContaining({ containerName: "conversateBody", content: " " }),
    ]);
    await mode.update({ inform: "Correction", body: "Transcript" });
    await mode.update({ inform: "", body: "" });
    expect(upgrades).toEqual(expect.arrayContaining([
      expect.objectContaining({ containerName: "conversateInform", content: " " }),
      expect.objectContaining({ containerName: "conversateBody", content: " " }),
    ]));
  });

  it("honors independent transcription and translation display toggles", () => {
    const snapshot = {
      ...createConversateSnapshot(),
      segments: [{ id: "one", text: "Hello", translation: "안녕하세요", at: new Date().toISOString() }],
    };
    expect(createNativeConversateContent(snapshot, "ko", {
      ...DEFAULT_CONVERSATE_SETTINGS, transcription: false,
    }).body).not.toContain("Hello");
    expect(createNativeConversateContent(snapshot, "ko", {
      ...DEFAULT_CONVERSATE_SETTINGS, translation: false,
    }).body).not.toContain("안녕하세요");
  });
});
