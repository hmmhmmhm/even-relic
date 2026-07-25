// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createHudDensityPage, transmitHudDensity } from "./hud-density";

describe("G2 HUD density transport", () => {
  it("keeps the proven page geometry without visible native text", () => {
    const page = createHudDensityPage();

    expect(page.containerTotalNum).toBe(3);
    expect(page.textObject).toHaveLength(2);
    expect(page.textObject?.every(({ content }) => content === " ")).toBe(true);
    expect(page.imageObject).toHaveLength(1);
    expect(page.imageObject?.[0]).toMatchObject({
      containerID: 3,
      containerName: "frame",
      xPosition: 188,
      yPosition: 40,
      width: 200,
      height: 100,
    });
  });

  it("sends the RELIC HUD bytes after the proven three-second wait", async () => {
    const calls: string[] = [];
    const reports: string[] = [];
    const hud = Uint8Array.from([137, 80, 78, 71]);
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: {
        containerID?: number;
        imageData?: number[] | string | Uint8Array | ArrayBuffer;
      }) => {
        const firstByte = update.imageData instanceof Uint8Array
          ? update.imageData[0]
          : "unexpected";
        calls.push(`image:${update.containerID}:${firstByte}`);
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await transmitHudDensity(
      (message) => reports.push(message),
      {
        waitForBridge: async () => bridge,
        loadBytes: async (url) => {
          expect(url).toBe("/relic-hud-200x100.png");
          return hud;
        },
        waitForPageReady: async (milliseconds) => {
          calls.push(`wait:${milliseconds}`);
        },
      },
    );

    expect(calls).toEqual(["create", "wait:3000", "image:3:137"]);
    expect(reports.at(-1)).toBe("RELIC HUD 200x100 전송 완료");
  });
});
