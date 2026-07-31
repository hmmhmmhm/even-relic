import { describe, expect, it } from "vitest";
import {
  createBlankDisplayPage,
  createImageDisplayPage,
  resolveG2DisplayHideStrategy,
} from "./g2-display-hide";
import { G2_TILES } from "./g2-canvas";

describe("G2 display hide strategy", () => {
  it.each([
    ["", "blank-rebuild"],
    ["?hide=blank", "blank-rebuild"],
    ["?hide=black", "black-tiles"],
    ["?hide=BLACK", "blank-rebuild"],
    ["?hide=invalid", "blank-rebuild"],
  ] as const)("resolves %s to %s", (search, expected) => {
    expect(resolveG2DisplayHideStrategy(search)).toBe(expected);
  });

  it("builds one full-screen blank event-capture container", () => {
    const page = createBlankDisplayPage().toJson();

    expect(page.containerTotalNum).toBe(1);
    expect(page.listObject ?? []).toEqual([]);
    expect(page.imageObject ?? []).toEqual([]);
    expect(page.textObject).toEqual([
      expect.objectContaining({
        xPosition: 0,
        yPosition: 0,
        width: 576,
        height: 288,
        borderWidth: 0,
        paddingLength: 0,
        containerID: 1,
        containerName: "eventLayer",
        content: " ",
        isEventCapture: 1,
      }),
    ]);
  });

  it("rebuilds the normal event layer and all four image containers", () => {
    const page = createImageDisplayPage(G2_TILES).toJson();

    expect(page.containerTotalNum).toBe(5);
    expect(page.textObject).toEqual([
      expect.objectContaining({ containerName: "eventLayer" }),
    ]);
    expect(page.imageObject?.map(
      (image: { containerID?: number }) => image.containerID,
    )).toEqual([
      2, 3, 4, 5,
    ]);
  });
});
