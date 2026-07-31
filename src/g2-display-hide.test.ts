import { describe, expect, it } from "vitest";
import {
  createBlankDisplayPage,
  resolveG2DisplayHideStrategy,
} from "./g2-display-hide";

describe("G2 display hide strategy", () => {
  it.each([
    ["", "black-tiles"],
    ["?hide=blank", "blank-rebuild"],
    ["?hide=BLACK", "black-tiles"],
    ["?hide=invalid", "black-tiles"],
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
});
