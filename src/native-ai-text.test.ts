import { describe, expect, it } from "vitest";
import { createAiHudSnapshot } from "./ai-hud-state";
import {
  createNativeAiTextContent,
  createNativeAiTextModeController,
  createNativeAiTextPage,
} from "./native-ai-text";

describe("native Ask AI text page", () => {
  it("uses one full-screen event-capturing text container", () => {
    const page = createNativeAiTextPage("ASK AI // READY");

    expect(page.containerTotalNum).toBe(1);
    expect(page.imageObject ?? []).toHaveLength(0);
    expect(page.textObject).toHaveLength(1);
    expect(page.textObject?.[0]).toMatchObject({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      containerID: 1,
      containerName: "aiTranscript",
      content: "ASK AI // READY",
      isEventCapture: 1,
    });
  });

  it("localizes roles, selected history state, listening status, and controls", () => {
    const snapshot = {
      ...createAiHudSnapshot(true),
      phase: "listening" as const,
      transcriptPages: [
        "YOU // Earlier\nAI // Previous answer",
        "YOU // Now\nAI // Streaming answer",
      ],
    };

    expect(createNativeAiTextContent(snapshot, 0, "ko")).toBe([
      "AI에게 묻기 // 듣는 중…  ·  대화 기록 1/2",
      "",
      "듣고 있습니다… 자연스럽게 말씀하세요.",
      "",
      "사용자 // Earlier",
      "AI // Previous answer",
      "",
      "스크롤 // 대화 기록",
      "두 번 탭 // 뒤로",
    ].join("\n"));
  });

  it("bounds unexpected transcript payloads", () => {
    const snapshot = {
      ...createAiHudSnapshot(true),
      phase: "listening" as const,
      transcriptPages: [`YOU // ${"x".repeat(5_000)}`],
    };

    const content = createNativeAiTextContent(snapshot, 0, "en");
    expect(content.length).toBeLessThanOrEqual(768);
    expect(content).toContain("Ask AI // LISTENING…");
    expect(content).toContain("DOUBLE TAP // BACK");
    expect(content).not.toContain("PAUSE");
  });
});

describe("native Ask AI text mode", () => {
  it("rebuilds once, upgrades text in place, and restores the image page", async () => {
    const rebuilt: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];
    const bridge = {
      rebuildPageContainer: async (page: { toJson?: () => Record<string, unknown> }) => {
        rebuilt.push(page.toJson?.() ?? page);
        return true;
      },
      textContainerUpgrade: async (value: { toJson?: () => Record<string, unknown> }) => {
        updated.push(value.toJson?.() ?? value);
        return true;
      },
    };
    const controller = createNativeAiTextModeController({
      bridge,
      createImagePage: () => ({
        containerTotalNum: 5,
        textObject: [],
        imageObject: [],
      } as never),
    });

    expect(await controller.enter("FIRST")).toBe(true);
    expect(controller.active()).toBe(true);
    expect(await controller.update("SECOND")).toBe(true);
    expect(await controller.update("SECOND")).toBe(false);
    expect(await controller.leave()).toBe(true);
    expect(controller.active()).toBe(false);

    expect(rebuilt).toHaveLength(2);
    expect(rebuilt[0]).toMatchObject({ containerTotalNum: 1 });
    expect(rebuilt[1]).toMatchObject({ containerTotalNum: 5 });
    expect(updated).toEqual([expect.objectContaining({
      containerID: 1,
      containerName: "aiTranscript",
      content: "SECOND",
    })]);
  });

  it("drops a text update while another one is in flight", async () => {
    let release: (() => void) | undefined;
    const bridge = {
      rebuildPageContainer: async () => true,
      textContainerUpgrade: async () => new Promise<boolean>((resolve) => {
        release = () => resolve(true);
      }),
    };
    const controller = createNativeAiTextModeController({
      bridge,
      createImagePage: () => ({}) as never,
    });
    await controller.enter("FIRST");

    const first = controller.update("SECOND");
    expect(await controller.update("THIRD")).toBe(false);
    release?.();
    expect(await first).toBe(true);
  });
});
