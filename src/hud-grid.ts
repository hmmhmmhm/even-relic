import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
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
  textContainerUpgrade: (update: TextContainerUpgrade) => Promise<boolean>;
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>;
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};

type HudGridDependencies = {
  waitForBridge: () => Promise<HudGridBridge>;
  loadBytes: (url: string) => Promise<Uint8Array>;
  waitForPageReady: (milliseconds: number) => Promise<void>;
};

function createEventLayer(content: string) {
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: 1,
    containerName: "eventLayer",
    content,
    isEventCapture: 1,
  });
}

export function createHudStagePage(
  tileCount: number,
  content: string,
) {
  const tiles = HUD_GRID_TILES.slice(0, tileCount);
  return new CreateStartUpPageContainer({
    containerTotalNum: tiles.length + 1,
    textObject: [createEventLayer(content)],
    imageObject: tiles.map((tile) => new ImageContainerProperty(tile)),
  });
}

function toRebuildPage(page: CreateStartUpPageContainer) {
  return new RebuildPageContainer({
    containerTotalNum: page.containerTotalNum,
    textObject: page.textObject,
    imageObject: page.imageObject,
  });
}

export async function transmitHudGrid(
  report: (message: string) => void,
  dependencies: HudGridDependencies = {
    waitForBridge: waitForEvenAppBridge,
    loadBytes: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`RELIC HUD 이미지 로드 실패: ${response.status}`);
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

  const startupPage = createHudStagePage(1, "RELIC HUD LOADING...");
  report("STAGE 1 STARTUP CREATING 1 IMAGE");
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(startupPage),
  );
  const resultName = StartUpPageCreateResult[created];
  report(`STAGE 1 STARTUP RESULT: ${resultName}`);

  if (created === StartUpPageCreateResult.invalid) {
    const rebuilt = await bridge.rebuildPageContainer(toRebuildPage(startupPage));
    report(`STAGE 1 REBUILD RESULT: ${rebuilt}`);
    if (!rebuilt) throw new Error("STAGE 1 REBUILD FAILED");
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`STAGE 1 STARTUP FAILED: ${resultName}`);
  }

  report("STAGE 1 LOADING READY - WAIT 3S");
  await dependencies.waitForPageReady(3000);
  report("STAGE 1 LOADING WAIT COMPLETE");

  const cleared = await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 1,
    containerName: "eventLayer",
    content: " ",
  }));
  report(`STAGE 1 LOADING CLEAR RESULT: ${cleared}`);

  for (let tileCount = 1; tileCount <= HUD_GRID_TILES.length; tileCount += 1) {
    const stage = tileCount;
    if (stage > 1) {
      report(`STAGE ${stage} REBUILDING ${tileCount} IMAGES`);
      const rebuilt = await bridge.rebuildPageContainer(
        toRebuildPage(createHudStagePage(tileCount, " ")),
      );
      report(`STAGE ${stage} REBUILD RESULT: ${rebuilt}`);
      if (!rebuilt) throw new Error(`STAGE ${stage} REBUILD FAILED`);
    }

    for (const tile of HUD_GRID_TILES.slice(0, tileCount)) {
      report(`STAGE ${stage} ${tile.containerName} LOAD`);
      const bytes = await dependencies.loadBytes(tile.file);
      const result = ImageRawDataUpdateResult.normalize(
        await bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: tile.containerID,
          containerName: tile.containerName,
          imageData: bytes,
        })),
      );
      report(`STAGE ${stage} ${tile.containerName} RESULT: ${result}`);
      if (!ImageRawDataUpdateResult.isSuccess(result)) {
        throw new Error(
          `STAGE ${stage} ${tile.containerName} 전송 실패: ${result}`,
        );
      }
      await dependencies.waitForPageReady(1000);
      report(`STAGE ${stage} ${tile.containerName} WAIT 1S COMPLETE`);
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
