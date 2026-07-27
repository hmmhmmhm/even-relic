import {
  DeviceModel,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  waitForEvenAppBridge,
  type CreateStartUpPageContainer,
  type DeviceInfo,
  type DeviceStatus,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import {
  G2_FAST_TILES,
  G2_LEFT_TILES,
  G2_RIGHT_TILES,
  G2_RIGHT_TOP_TILES,
  G2_TILES,
  createBlackCanvas,
  createContainerObjects,
  createGlassesPage,
  encodeCanvasTiles,
  sendTilesSequentially,
  type Tile,
} from "./g2-canvas";

type Bridge = {
  createStartUpPageContainer: (
    page: CreateStartUpPageContainer,
  ) => Promise<unknown>;
  getDeviceInfo?: () => Promise<DeviceInfo | null>;
  onDeviceStatusChanged?: (
    listener: (status: DeviceStatus) => void,
  ) => () => void;
  rebuildPageContainer: (page: RebuildPageContainer) => Promise<boolean>;
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>;
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};
type TransportDependencies = {
  waitForBridge: () => Promise<Bridge>;
  encode: typeof encodeCanvasTiles;
};
type DisplayToggle = {
  readonly beforeRestore?: () => void | Promise<void>;
  readonly createHiddenSource: () => HTMLCanvasElement;
};
type ExternalRefresh = {
  readonly beforeExternalRefresh?: () => void | Promise<void>;
  readonly onRefreshReady?: (request: FastCanvasRefreshRequest) => void;
  readonly targetTiles: Readonly<
    Record<FastCanvasRefreshTarget, readonly Tile[]>
  >;
};

export type PageDirection = "next" | "previous";
export type FastCanvasInput =
  | "tap"
  | "double-tap"
  | "scroll-next"
  | "scroll-previous";
export type FastCanvasInputResult = "unhandled" | "consume" | "redraw";
export type FastCanvasBattery = {
  readonly label: "G1" | "G2" | "R1";
  readonly level?: number;
  readonly charging?: boolean;
};
export type FastCanvasRefreshTarget =
  | "left"
  | "right"
  | "right-top"
  | "all";
export type FastCanvasRefreshRequest = (
  target: FastCanvasRefreshTarget,
) => void;
export type FastCanvasOptions = {
  readonly beforeExternalRefresh?: () => void | Promise<void>;
  readonly beforeRestore?: () => void | Promise<void>;
  readonly createHiddenSource?: () => HTMLCanvasElement;
  readonly dependencies?: TransportDependencies;
  readonly onBattery?: (
    battery: FastCanvasBattery | undefined,
  ) => void;
  readonly onInput?: (
    input: FastCanvasInput,
  ) => FastCanvasInputResult | Promise<FastCanvasInputResult>;
  readonly onRefreshReady?: (request: FastCanvasRefreshRequest) => void;
};

export function toFastCanvasBattery(
  device: DeviceInfo | null | undefined,
): FastCanvasBattery | undefined {
  if (!device) return undefined;
  const label = device.model === DeviceModel.Ring1
    ? "R1"
    : device.model === DeviceModel.G2
      ? "G2"
      : "G1";
  return {
    label,
    level: device.status.batteryLevel,
    charging: device.status.isCharging,
  };
}

function isSameFastCanvasBattery(
  left: FastCanvasBattery | undefined,
  right: FastCanvasBattery | undefined,
): boolean {
  return left?.label === right?.label
    && left?.level === right?.level
    && left?.charging === right?.charging;
}

export async function transmitCanvas(
  source: HTMLCanvasElement,
  onProgress: (message: string) => void,
  dependencies: TransportDependencies = {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  },
  tiles: readonly Tile[] = G2_TILES,
  onNavigate?: (direction: PageDirection) => void | Promise<void>,
  navigationTiles: readonly Tile[] = tiles,
  displayToggle?: DisplayToggle,
  externalRefresh?: ExternalRefresh,
  onInput?: (
    input: FastCanvasInput,
  ) => FastCanvasInputResult | Promise<FastCanvasInputResult>,
) {
  onProgress("Even 앱 브리지 연결 대기 중");
  const bridge = await dependencies.waitForBridge();
  onProgress("안경 페이지 생성 중");

  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(createGlassesPage(tiles)),
  );
  if (created === StartUpPageCreateResult.invalid) {
    onProgress("기존 안경 페이지 재구성 중");
    const { eventLayer, imageObject } = createContainerObjects(tiles);
    const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: tiles.length + 1,
      textObject: [eventLayer],
      imageObject,
    }));
    if (!rebuilt) throw new Error("기존 안경 페이지 재구성 실패");
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`안경 페이지 생성 실패: ${created}`);
  }

  const refreshImages = async (
    imageSource: HTMLCanvasElement,
    targetTiles: readonly Tile[],
    completionMessage: string,
    shouldContinue: () => boolean = () => true,
  ) => {
    if (!shouldContinue()) return;
    const encodedTiles = await dependencies.encode(
      imageSource,
      undefined,
      targetTiles,
    );
    if (!shouldContinue()) return;
    await sendTilesSequentially(encodedTiles, async (bytes, index) => {
      if (!shouldContinue()) return;
      const tile = targetTiles[index];
      const result = ImageRawDataUpdateResult.normalize(
        await bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: tile.id,
          containerName: tile.name,
          imageData: bytes,
        })),
      );
      if (!ImageRawDataUpdateResult.isSuccess(result)) {
        throw new Error(`${tile.name} 전송 실패: ${result}`);
      }
      onProgress(`안경 이미지 전송 중 ${index + 1}/${targetTiles.length}`);
    });
    if (!shouldContinue()) return;
    onProgress(completionMessage);
  };

  await refreshImages(source, tiles, "안경 전송 완료");
  let disposed = false;
  let hidden = false;
  let hiddenSource: HTMLCanvasElement | undefined;
  let operationQueue = Promise.resolve();
  const queueOperation = (operation: () => void | Promise<void>) => {
    if (disposed) return;
    operationQueue = operationQueue
      .then(() => {
        if (!disposed) return operation();
      })
      .catch((error: unknown) => {
        onProgress(error instanceof Error ? error.message : String(error));
      });
  };
  const performNavigation = async (direction: PageDirection) => {
    if (!onNavigate || hidden || disposed) return;
    onProgress("HUD 페이지 전환 중");
    await onNavigate(direction);
    if (disposed) return;
    await refreshImages(source, navigationTiles, "페이지 전송 완료");
  };
  const performDisplayToggle = async () => {
    if (disposed) return;
    if (!displayToggle) {
      await bridge.shutDownPageContainer(1);
      return;
    }
    if (hidden) {
      onProgress("HUD 표시 복원 중");
      await displayToggle.beforeRestore?.();
      if (disposed) return;
      await refreshImages(source, tiles, "HUD 표시 복원 완료");
      hidden = false;
    } else {
      onProgress("HUD 표시 숨기는 중");
      await refreshImages(
        hiddenSource ??= displayToggle.createHiddenSource(),
        tiles,
        "HUD 표시 숨김 완료",
      );
      hidden = true;
    }
  };
  const queueInput = (
    input: FastCanvasInput,
    fallback?: () => void | Promise<void>,
  ) => {
    if (disposed || (hidden && input !== "double-tap")) return;
    queueOperation(async () => {
      if (disposed) return;
      if (hidden) {
        if (input === "double-tap") await performDisplayToggle();
        return;
      }
      const result = await onInput?.(input) ?? "unhandled";
      if (disposed) return;
      if (result === "redraw") {
        await refreshImages(source, tiles, "상세 화면 전송 완료");
      } else if (result === "unhandled") {
        await fallback?.();
      }
    });
  };
  let pendingRefreshTarget: FastCanvasRefreshTarget | undefined;
  let externalRefreshScheduled = false;
  const scheduleExternalRefresh = () => {
    if (!externalRefresh || externalRefreshScheduled || disposed) return;
    externalRefreshScheduled = true;
    queueOperation(async () => {
      try {
        const target = pendingRefreshTarget;
        pendingRefreshTarget = undefined;
        if (!target || hidden || disposed) return;
        onProgress("라이브 HUD 갱신 중");
        if (disposed) return;
        await externalRefresh.beforeExternalRefresh?.();
        if (hidden || disposed) return;
        await refreshImages(
          source,
          externalRefresh.targetTiles[target],
          "라이브 HUD 갱신 완료",
          () => !disposed && !hidden,
        );
      } finally {
        externalRefreshScheduled = false;
        if (!disposed && pendingRefreshTarget) scheduleExternalRefresh();
      }
    });
  };
  const requestExternalRefresh: FastCanvasRefreshRequest = (target) => {
    if (disposed) return;
    if (
      pendingRefreshTarget === "all"
      || target === "all"
      || (pendingRefreshTarget && pendingRefreshTarget !== target)
    ) {
      pendingRefreshTarget = "all";
    } else {
      pendingRefreshTarget = target;
    }
    scheduleExternalRefresh();
  };

  const sdkUnsubscribe = bridge.onEvenHubEvent((event) => {
    if (disposed) return;
    const eventType = event.sysEvent?.eventType
      ?? event.textEvent?.eventType
      ?? null;
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      queueInput("tap");
    } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      queueInput("double-tap", performDisplayToggle);
    } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      queueInput("scroll-next", () => performNavigation("next"));
    } else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      queueInput("scroll-previous", () => performNavigation("previous"));
    }
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    pendingRefreshTarget = undefined;
    externalRefreshScheduled = false;
    sdkUnsubscribe();
  };
  try {
    externalRefresh?.onRefreshReady?.(requestExternalRefresh);
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}

export async function transmitFastCanvas(
  source: HTMLCanvasElement,
  onProgress: (message: string) => void,
  onNavigate: (direction: PageDirection) => void | Promise<void>,
  options: FastCanvasOptions = {},
) {
  const baseDependencies = options.dependencies ?? {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  };
  let connectedBridge: Bridge | undefined;
  let deviceInfo: DeviceInfo | null | undefined;
  let lastBattery: FastCanvasBattery | undefined;
  const dependencies: TransportDependencies = {
    ...baseDependencies,
    waitForBridge: async () => {
      const bridge = await baseDependencies.waitForBridge();
      connectedBridge = bridge;
      if (options.onBattery) {
        try {
          deviceInfo = await bridge.getDeviceInfo?.();
          lastBattery = toFastCanvasBattery(deviceInfo);
          options.onBattery(lastBattery);
        } catch {
          deviceInfo = undefined;
          lastBattery = undefined;
          options.onBattery(undefined);
        }
      }
      return bridge;
    },
  };
  const transportCleanup = await transmitCanvas(
    source,
    onProgress,
    dependencies,
    G2_FAST_TILES,
    onNavigate,
    G2_RIGHT_TILES,
    {
      createHiddenSource: options.createHiddenSource ?? createBlackCanvas,
      beforeRestore: options.beforeRestore,
    },
    {
      beforeExternalRefresh: options.beforeExternalRefresh,
      onRefreshReady: options.onRefreshReady,
      targetTiles: {
        all: G2_FAST_TILES,
        left: G2_LEFT_TILES,
        right: G2_RIGHT_TILES,
        "right-top": G2_RIGHT_TOP_TILES,
      },
    },
    options.onInput,
  );
  let cleaned = false;
  let unsubscribeDeviceStatus: (() => void) | undefined;
  if (deviceInfo && connectedBridge?.onDeviceStatusChanged) {
    try {
      unsubscribeDeviceStatus = connectedBridge.onDeviceStatusChanged(
        (status) => {
          if (
            cleaned
            || status.sn !== deviceInfo?.sn
            || !lastBattery
          ) {
            return;
          }
          const nextBattery: FastCanvasBattery = {
            label: lastBattery.label,
            level: status.batteryLevel ?? lastBattery.level,
            charging: status.isCharging ?? lastBattery.charging,
          };
          if (isSameFastCanvasBattery(lastBattery, nextBattery)) return;
          lastBattery = nextBattery;
          options.onBattery?.(nextBattery);
        },
      );
    } catch {
      unsubscribeDeviceStatus = undefined;
    }
  }

  return () => {
    if (cleaned) return;
    cleaned = true;
    unsubscribeDeviceStatus?.();
    transportCleanup();
  };
}
