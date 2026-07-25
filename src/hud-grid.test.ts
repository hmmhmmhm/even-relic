// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  HUD_GRID_TILES,
  createHudGridPage,
  createHudStagePage,
  createLoadingPage,
  transmitHudGrid,
} from "./hud-grid";

describe("G2 400x200 HUD grid", () => {
  it("builds cumulative stages with loading text only on stage 1", () => {
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

  it("uses a text-only loading page before the centered 2x2 image grid", () => {
    expect(HUD_GRID_TILES).toEqual([
      {
        containerID: 2,
        containerName: "relicTL",
        xPosition: 88,
        yPosition: 44,
        width: 200,
        height: 100,
        file: "/relic-hud-400x200/relic-tl.png",
      },
      {
        containerID: 3,
        containerName: "relicTR",
        xPosition: 288,
        yPosition: 44,
        width: 200,
        height: 100,
        file: "/relic-hud-400x200/relic-tr.png",
      },
      {
        containerID: 4,
        containerName: "relicBL",
        xPosition: 88,
        yPosition: 144,
        width: 200,
        height: 100,
        file: "/relic-hud-400x200/relic-bl.png",
      },
      {
        containerID: 5,
        containerName: "relicBR",
        xPosition: 288,
        yPosition: 144,
        width: 200,
        height: 100,
        file: "/relic-hud-400x200/relic-br.png",
      },
    ]);

    const loadingPage = createLoadingPage();
    expect(loadingPage.containerTotalNum).toBe(1);
    expect(loadingPage.textObject).toHaveLength(1);
    expect(loadingPage.textObject?.[0].content).toBe("RELIC HUD LOADING...");
    expect(loadingPage.imageObject).toBeUndefined();

    const gridPage = createHudGridPage();
    expect(gridPage.containerTotalNum).toBe(5);
    expect(gridPage.textObject).toHaveLength(1);
    expect(gridPage.textObject?.[0].content).toBe(" ");
    expect(gridPage.imageObject).toHaveLength(4);
  });

  it("creates the loading page, waits three seconds, then rebuilds and sends serially", async () => {
    const calls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async (page: { imageObject?: unknown[] }) => {
        calls.push(`create:${page.imageObject?.length ?? 0}`);
        return 0;
      },
      rebuildPageContainer: async (page: { imageObject?: unknown[] }) => {
        calls.push(`rebuild:${page.imageObject?.length ?? 0}`);
        return true;
      },
      updateImageRawData: async (update: {
        containerName?: string;
        imageData?: number[] | string | Uint8Array | ArrayBuffer;
      }) => {
        calls.push(`send:${update.containerName}`);
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await transmitHudGrid(
      () => undefined,
      {
        waitForBridge: async () => bridge,
        loadBytes: async (url) => {
          calls.push(`load:${url.split("/").at(-1)}`);
          return Uint8Array.from([137]);
        },
        waitForPageReady: async (milliseconds) => {
          calls.push(`wait:${milliseconds}`);
        },
      },
    );

    expect(calls).toEqual([
      "create:0",
      "wait:3000",
      "rebuild:4",
      "load:relic-tl.png",
      "send:relicTL",
      "load:relic-tr.png",
      "send:relicTR",
      "load:relic-bl.png",
      "send:relicBL",
      "load:relic-br.png",
      "send:relicBR",
    ]);
  });

  it("rebuilds the text-only loading page first when startup creation is invalid", async () => {
    const calls: string[] = [];
    const reports: string[] = [];
    const bridge = {
      createStartUpPageContainer: async (page: { imageObject?: unknown[] }) => {
        calls.push(`create:${page.imageObject?.length ?? 0}`);
        return 1;
      },
      rebuildPageContainer: async (page: { imageObject?: unknown[] }) => {
        calls.push(`rebuild:${page.imageObject?.length ?? 0}`);
        return true;
      },
      updateImageRawData: async (update: {
        containerName?: string;
        imageData?: number[] | string | Uint8Array | ArrayBuffer;
      }) => {
        calls.push(`image:${update.containerName}`);
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await transmitHudGrid(
      (message) => reports.push(message),
      {
        waitForBridge: async () => bridge,
        loadBytes: async () => Uint8Array.from([137]),
        waitForPageReady: async () => {
          calls.push("wait:3000");
        },
      },
    );

    expect(calls).toEqual([
      "create:0",
      "rebuild:0",
      "wait:3000",
      "rebuild:4",
      "image:relicTL",
      "image:relicTR",
      "image:relicBL",
      "image:relicBR",
    ]);
    expect(reports).toContain("LOADING PAGE REBUILD RESULT: true");
  });

  it("stops before the timer when the loading page cannot rebuild", async () => {
    const calls: string[] = [];
    const reports: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 1;
      },
      rebuildPageContainer: async () => {
        calls.push("rebuild");
        return false;
      },
      updateImageRawData: async () => {
        calls.push("unexpected-image");
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await expect(transmitHudGrid(
      (message) => reports.push(message),
      {
        waitForBridge: async () => bridge,
        loadBytes: async () => {
          calls.push("unexpected-load");
          return Uint8Array.from([137]);
        },
        waitForPageReady: async () => {
          calls.push("unexpected-wait");
        },
      },
    )).rejects.toThrow("LOADING PAGE REBUILD FAILED");

    expect(calls).toEqual(["create", "rebuild"]);
    expect(reports).toContain("LOADING PAGE REBUILD RESULT: false");
  });

  it("stops before image transfer when the HUD grid rebuild fails", async () => {
    const calls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      rebuildPageContainer: async () => {
        calls.push("rebuild");
        return false;
      },
      updateImageRawData: async () => {
        calls.push("unexpected-image");
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await expect(transmitHudGrid(
      () => undefined,
      {
        waitForBridge: async () => bridge,
        loadBytes: async () => {
          calls.push("unexpected-load");
          return Uint8Array.from([137]);
        },
        waitForPageReady: async (milliseconds) => {
          calls.push(`wait:${milliseconds}`);
        },
      },
    )).rejects.toThrow("HUD GRID REBUILD FAILED");

    expect(calls).toEqual(["create", "wait:3000", "rebuild"]);
  });
});
