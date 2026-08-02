import {
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
} from "@evenrealities/even_hub_sdk";
import {
  createContainerObjects,
  createGlassesPage,
  type Tile,
} from "./g2-canvas";

export type G2DisplayHideStrategy = "black-tiles" | "blank-rebuild";

export const G2_IMAGE_PAGE_SETTLE_MS = 200;

type ImagePageBridge = {
  createStartUpPageContainer: (
    page: ReturnType<typeof createGlassesPage>,
  ) => Promise<unknown>;
  rebuildPageContainer: (page: RebuildPageContainer) => Promise<boolean>;
};

export async function initializeImageDisplayPage(
  bridge: ImagePageBridge,
  tiles: readonly Tile[],
): Promise<void> {
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(createGlassesPage(tiles)),
  );
  if (created === StartUpPageCreateResult.invalid) {
    const rebuilt = await bridge.rebuildPageContainer(
      createImageDisplayPage(tiles),
    );
    if (!rebuilt) throw new Error("Existing glasses page rebuild failed");
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`Glasses page creation failed: ${created}`);
  }
}

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
