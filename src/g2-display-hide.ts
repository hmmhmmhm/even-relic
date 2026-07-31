import {
  RebuildPageContainer,
  TextContainerProperty,
} from "@evenrealities/even_hub_sdk";
import { createContainerObjects, type Tile } from "./g2-canvas";

export type G2DisplayHideStrategy = "black-tiles" | "blank-rebuild";

export function resolveG2DisplayHideStrategy(
  search: string,
): G2DisplayHideStrategy {
  return new URLSearchParams(search).get("hide") === "black"
    ? "black-tiles"
    : "blank-rebuild";
}

export function createBlankDisplayPage(): RebuildPageContainer {
  return new RebuildPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: 576,
        height: 288,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        paddingLength: 0,
        containerID: 1,
        containerName: "eventLayer",
        content: " ",
        isEventCapture: 1,
      }),
    ],
  });
}

export function createImageDisplayPage(
  tiles: readonly Tile[],
): RebuildPageContainer {
  const { eventLayer, imageObject } = createContainerObjects(tiles);
  return new RebuildPageContainer({
    containerTotalNum: tiles.length + 1,
    textObject: [eventLayer],
    imageObject,
  });
}
