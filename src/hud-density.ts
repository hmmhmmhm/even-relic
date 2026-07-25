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

type HudDensityBridge = {
  createStartUpPageContainer: (page: CreateStartUpPageContainer) => Promise<unknown>;
  rebuildPageContainer: (page: RebuildPageContainer) => Promise<boolean>;
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>;
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};

type HudDensityDependencies = {
  waitForBridge: () => Promise<HudDensityBridge>;
  loadBytes: (url: string) => Promise<Uint8Array>;
  waitForPageReady: (milliseconds: number) => Promise<void>;
};

export function createHudDensityPage() {
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
  const blankStatus = new TextContainerProperty({
    xPosition: 0,
    yPosition: 220,
    width: 576,
    height: 40,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: 2,
    containerName: "status",
    content: " ",
    isEventCapture: 0,
  });
  const image = new ImageContainerProperty({
    xPosition: 188,
    yPosition: 40,
    width: 200,
    height: 100,
    containerID: 3,
    containerName: "frame",
  });
  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [eventLayer, blankStatus],
    imageObject: [image],
  });
}

export async function transmitHudDensity(
  report: (message: string) => void,
  dependencies: HudDensityDependencies = {
    waitForBridge: waitForEvenAppBridge,
    loadBytes: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`RELIC HUD 로드 실패: ${response.status}`);
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
  const page = createHudDensityPage();
  report("PAGE CREATING");
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

  report("PAGE READY 200x100 - SEND IN 3S");
  await dependencies.waitForPageReady(3000);
  const bytes = await dependencies.loadBytes("/relic-hud-200x100.png");
  const result = ImageRawDataUpdateResult.normalize(
    await bridge.updateImageRawData(new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: bytes,
    })),
  );
  if (!ImageRawDataUpdateResult.isSuccess(result)) {
    throw new Error(`RELIC HUD 전송 실패: ${result}`);
  }
  report("RELIC HUD 200x100 전송 완료");

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
