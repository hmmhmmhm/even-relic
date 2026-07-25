// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  HUD_GRID_TILES,
  createHudStagePage,
  transmitHudGrid,
} from "./hud-grid";

type BridgeOptions = {
  created?: number;
  rebuildResult?: (imageCount: number) => boolean;
  imageResult?: (stage: number, containerName: string) => string;
};

function createBridge(calls: string[], options: BridgeOptions = {}) {
  let currentStage = 0;
  return {
    createStartUpPageContainer: async (page: { imageObject?: unknown[] }) => {
      currentStage = page.imageObject?.length ?? 0;
      calls.push(`create:${currentStage}`);
      return options.created ?? 0;
    },
    rebuildPageContainer: async (page: { imageObject?: unknown[] }) => {
      currentStage = page.imageObject?.length ?? 0;
      calls.push(`rebuild:${currentStage}`);
      return options.rebuildResult?.(currentStage) ?? true;
    },
    textContainerUpgrade: async (update: { content?: string }) => {
      calls.push(`text:${update.content}`);
      return true;
    },
    updateImageRawData: async (update: { containerName?: string }) => {
      const name = update.containerName ?? "";
      calls.push(`send:${name}`);
      return options.imageResult?.(currentStage, name) ?? "success";
    },
    onEvenHubEvent: () => () => undefined,
    shutDownPageContainer: async () => true,
  };
}

function createDependencies(
  calls: string[],
  bridge: ReturnType<typeof createBridge>,
) {
  return {
    waitForBridge: async () => bridge,
    loadBytes: async () => Uint8Array.from([137]),
    waitForPageReady: async (milliseconds: number) => {
      calls.push(`wait:${milliseconds}`);
    },
  };
}

describe("G2 400x200 incremental HUD grid", () => {
  it("builds cumulative stages with loading text only on stage 1", () => {
    expect(HUD_GRID_TILES.map((tile) => ({
      name: tile.containerName,
      x: tile.xPosition,
      y: tile.yPosition,
    }))).toEqual([
      { name: "relicTL", x: 88, y: 44 },
      { name: "relicTR", x: 288, y: 44 },
      { name: "relicBL", x: 88, y: 144 },
      { name: "relicBR", x: 288, y: 144 },
    ]);

    const stage1 = createHudStagePage(1, "RELIC HUD LOADING...");
    expect(stage1.containerTotalNum).toBe(2);
    expect(stage1.textObject?.[0].content).toBe("RELIC HUD LOADING...");
    expect(stage1.imageObject?.map((image) => image.containerName)).toEqual([
      "relicTL",
    ]);

    const stage4 = createHudStagePage(4, " ");
    expect(stage4.containerTotalNum).toBe(5);
    expect(stage4.textObject?.[0].content).toBe(" ");
    expect(stage4.imageObject?.map((image) => image.containerName)).toEqual([
      "relicTL",
      "relicTR",
      "relicBL",
      "relicBR",
    ]);
  });

  it("creates stage 1, waits, then rebuilds and retransmits stages 2 through 4", async () => {
    const calls: string[] = [];
    const bridge = createBridge(calls);

    await transmitHudGrid(
      () => undefined,
      createDependencies(calls, bridge),
    );

    expect(calls).toEqual([
      "create:1",
      "wait:3000",
      "text: ",
      "send:relicTL",
      "wait:1000",
      "rebuild:2",
      "send:relicTL",
      "wait:1000",
      "send:relicTR",
      "wait:1000",
      "rebuild:3",
      "send:relicTL",
      "wait:1000",
      "send:relicTR",
      "wait:1000",
      "send:relicBL",
      "wait:1000",
      "rebuild:4",
      "send:relicTL",
      "wait:1000",
      "send:relicTR",
      "wait:1000",
      "send:relicBL",
      "wait:1000",
      "send:relicBR",
      "wait:1000",
    ]);
  });

  it("rebuilds stage 1 when startup creation returns invalid", async () => {
    const calls: string[] = [];
    const reports: string[] = [];
    const bridge = createBridge(calls, { created: 1 });

    await transmitHudGrid(
      (message) => reports.push(message),
      createDependencies(calls, bridge),
    );

    expect(calls.slice(0, 4)).toEqual([
      "create:1",
      "rebuild:1",
      "wait:3000",
      "text: ",
    ]);
    expect(reports).toContain("STAGE 1 REBUILD RESULT: true");
  });

  it("stops before loading stage 3 images when stage 3 rebuild fails", async () => {
    const calls: string[] = [];
    const reports: string[] = [];
    const bridge = createBridge(calls, {
      rebuildResult: (imageCount) => imageCount !== 3,
    });

    await expect(transmitHudGrid(
      (message) => reports.push(message),
      createDependencies(calls, bridge),
    )).rejects.toThrow("STAGE 3 REBUILD FAILED");

    expect(calls).not.toContain("rebuild:4");
    expect(reports).toContain("STAGE 3 REBUILD RESULT: false");
    expect(reports).not.toContain("STAGE 3 relicBL LOAD");
  });

  it("stops before stage 3 when the stage 2 TR image transfer fails", async () => {
    const calls: string[] = [];
    const reports: string[] = [];
    const bridge = createBridge(calls, {
      imageResult: (stage, name) => (
        stage === 2 && name === "relicTR" ? "sendFailed" : "success"
      ),
    });

    await expect(transmitHudGrid(
      (message) => reports.push(message),
      createDependencies(calls, bridge),
    )).rejects.toThrow("STAGE 2 relicTR 전송 실패: sendFailed");

    expect(reports).not.toContain("STAGE 3 REBUILDING 3 IMAGES");
  });
});
