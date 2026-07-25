// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  HUD_GRID_TILES,
  createHudGridPage,
  transmitHudGrid,
} from "./hud-grid";

describe("G2 400x200 HUD grid", () => {
  it("centers four proven 200x100 image containers as a 2x2 grid", () => {
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

    const page = createHudGridPage();
    expect(page.containerTotalNum).toBe(5);
    expect(page.textObject).toHaveLength(1);
    expect(page.textObject?.[0].content).toBe(" ");
    expect(page.imageObject).toHaveLength(4);
  });

  it("waits three seconds and transmits TL, TR, BL, BR sequentially", async () => {
    const calls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      rebuildPageContainer: async () => true,
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
      "create",
      "wait:3000",
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

  it("closes a stale native page when invalid cannot rebuild", async () => {
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
        calls.push("image");
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async (exitMode: number) => {
        calls.push(`shutdown:${exitMode}`);
        return true;
      },
    };

    await expect(transmitHudGrid(
      (message) => reports.push(message),
      {
        waitForBridge: async () => bridge,
        loadBytes: async () => Uint8Array.from([137]),
        waitForPageReady: async () => {
          calls.push("wait");
        },
      },
    )).rejects.toThrow("STALE PAGE CLOSED - REOPEN THIS URL");

    expect(calls).toEqual(["create", "rebuild", "shutdown:0"]);
    expect(reports.slice(-2)).toEqual([
      "STALE PAGE CLOSING",
      "STALE PAGE CLOSE RESULT: true",
    ]);
  });
});
