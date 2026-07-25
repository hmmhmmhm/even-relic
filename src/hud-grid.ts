import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";

export const HUD_GRID_TILES = [
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
] as const;

type HudGridBridge = {
  createStartUpPageContainer: (page: CreateStartUpPageContainer) => Promise<unknown>;
  rebuildPageContainer: (page: RebuildPageContainer) => Promise<boolean>;
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>;
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};

type HudGridDependencies = {
  waitForBridge: () => Promise<HudGridBridge>;
  loadBytes: (url: string) => Promise<Uint8Array>;
  waitForPageReady: (milliseconds: number) => Promise<void>;
};

export function createHudGridPage() {
  const eventLayer = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: 1,
    containerName: "eventLayer",
    content: " ",
    isEventCapture: 1,
  });
  const images = HUD_GRID_TILES.map((tile) => (
    new ImageContainerProperty(tile)
  ));
  return new CreateStartUpPageContainer({
    containerTotalNum: 5,
    textObject: [eventLayer],
    imageObject: images,
  });
}

export async function transmitHudGrid(
  report: (message: string) => void,
  dependencies: HudGridDependencies = {
    waitForBridge: waitForEvenAppBridge,
    loadBytes: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`RELIC HUD 타일 로드 실패: ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
    waitForPageReady: (milliseconds) => new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    }),
  },
) {
  report("BRIDGE WAIT");
  const bridge = await dependencies.waitForBridge();
  report("BRIDGE READY");
  const page = createHudGridPage();
  report("PAGE CREATING 400x200");
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(page),
  );
  const resultName = StartUpPageCreateResult[created];
  report(`PAGE RESULT: ${resultName}`);

  if (created === StartUpPageCreateResult.invalid) {
    report("PAGE REBUILDING");
    const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: page.containerTotalNum,
      textObject: page.textObject,
      imageObject: page.imageObject,
    }));
    report(`PAGE REBUILD RESULT: ${rebuilt}`);
    if (!rebuilt) throw new Error("PAGE REBUILD FAILED");
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`PAGE CREATE FAILED: ${resultName}`);
  }

  report("PAGE READY 400x200 - SEND IN 3S");
  await dependencies.waitForPageReady(3000);
  for (const [index, tile] of HUD_GRID_TILES.entries()) {
    const progress = `${index + 1}/4`;
    report(`${tile.containerName} LOAD ${progress}`);
    const bytes = await dependencies.loadBytes(tile.file);
    const result = ImageRawDataUpdateResult.normalize(
      await bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: tile.containerID,
        containerName: tile.containerName,
        imageData: bytes,
      })),
    );
    report(`${tile.containerName} RESULT: ${result} ${progress}`);
    if (!ImageRawDataUpdateResult.isSuccess(result)) {
      throw new Error(`${tile.containerName} 전송 실패: ${result}`);
    }
  }
  report("RELIC HUD 400x200 전송 완료");

  return bridge.onEvenHubEvent((event) => {
    const systemEvent = event.sysEvent?.eventType ?? null;
    const textEvent = event.textEvent?.eventType ?? null;
    if (
      systemEvent === OsEventTypeList.DOUBLE_CLICK_EVENT
      || textEvent === OsEventTypeList.DOUBLE_CLICK_EVENT
    ) {
      void bridge.shutDownPageContainer(1);
    }
  });
}
