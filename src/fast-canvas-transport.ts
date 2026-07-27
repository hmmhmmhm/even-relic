import {
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  waitForEvenAppBridge,
} from "@evenrealities/even_hub_sdk";
import {
  G2_TILES,
  createContainerObjects,
  createGlassesPage,
  encodeCanvasTiles,
  sendTilesSequentially,
  type Tile,
} from "./g2-canvas";
import { logDiagnostic } from "./diagnostic-log";
import type {
  Bridge,
  DisplayToggle,
  ExternalRefresh,
  FastCanvasInput,
  FastCanvasInputResult,
  FastCanvasRawEvent,
  FastCanvasRefreshRequest,
  FastCanvasRefreshTarget,
  PageDirection,
  TransportDependencies,
} from "./fast-canvas-types";

export type {
  FastCanvasBattery,
  FastCanvasInput,
  FastCanvasInputResult,
  FastCanvasOptions,
  FastCanvasRawEvent,
  FastCanvasRefreshRequest,
  FastCanvasRefreshTarget,
  PageDirection,
} from "./fast-canvas-types";

const diagnosticNow = () => (
  typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now()
);

const diagnosticDuration = (startedAt: number) => (
  diagnosticNow() - startedAt
);

const diagnosticError = (error: unknown) => (
  error instanceof Error ? error.message : String(error)
);

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
  onRawEvent?: (event: FastCanvasRawEvent) => void,
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
    if (!shouldContinue()) {
      logDiagnostic("REFRESH", "image refresh skipped before encode");
      return;
    }
    const encodeStartedAt = diagnosticNow();
    logDiagnostic("ENCODE", `start · ${targetTiles.length} tiles`);
    let encodedTiles: Uint8Array[];
    try {
      encodedTiles = await dependencies.encode(
        imageSource,
        undefined,
        targetTiles,
      );
      logDiagnostic(
        "ENCODE",
        `complete · ${targetTiles.length} tiles`,
        diagnosticDuration(encodeStartedAt),
      );
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `encode failed · ${diagnosticError(error)}`,
        diagnosticDuration(encodeStartedAt),
      );
      throw error;
    }
    if (!shouldContinue()) return;
    await sendTilesSequentially(encodedTiles, async (bytes, index) => {
      if (!shouldContinue()) return;
      const tile = targetTiles[index];
      const tileStartedAt = diagnosticNow();
      logDiagnostic(
        "TILE",
        `${tile.name} start · ${index + 1}/${targetTiles.length}`,
      );
      let result: ImageRawDataUpdateResult;
      try {
        result = ImageRawDataUpdateResult.normalize(
          await bridge.updateImageRawData(new ImageRawDataUpdate({
            containerID: tile.id,
            containerName: tile.name,
            imageData: bytes,
          })),
        );
      } catch (error) {
        logDiagnostic(
          "ERROR",
          `${tile.name} send threw · ${diagnosticError(error)}`,
          diagnosticDuration(tileStartedAt),
        );
        throw error;
      }
      if (!ImageRawDataUpdateResult.isSuccess(result)) {
        logDiagnostic(
          "ERROR",
          `${tile.name} failed · ${String(result)}`,
          diagnosticDuration(tileStartedAt),
        );
        throw new Error(`${tile.name} 전송 실패: ${result}`);
      }
      logDiagnostic(
        "TILE",
        `${tile.name} success`,
        diagnosticDuration(tileStartedAt),
      );
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
  let operationSequence = 0;
  let pendingOperationCount = 0;
  const queueOperation = (
    label: string,
    operation: () => void | Promise<void>,
  ) => {
    if (disposed) {
      logDiagnostic("REFRESH", `${label} dropped · disposed`);
      return;
    }
    operationSequence += 1;
    pendingOperationCount += 1;
    const operationId = operationSequence;
    logDiagnostic(
      "REFRESH",
      `operation #${operationId} ${label} queued · pending ${pendingOperationCount}`,
    );
    operationQueue = operationQueue
      .then(async () => {
        const startedAt = diagnosticNow();
        logDiagnostic(
          "REFRESH",
          `operation #${operationId} ${label} start`,
        );
        try {
          if (!disposed) await operation();
          logDiagnostic(
            "REFRESH",
            `operation #${operationId} ${label} complete`,
            diagnosticDuration(startedAt),
          );
        } catch (error) {
          logDiagnostic(
            "ERROR",
            `operation #${operationId} ${label} failed · ${diagnosticError(error)}`,
            diagnosticDuration(startedAt),
          );
          onProgress(diagnosticError(error));
        } finally {
          pendingOperationCount -= 1;
        }
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
      logDiagnostic("REFRESH", "shutdown complete");
      return;
    }
    if (hidden) {
      logDiagnostic("REFRESH", "restore start");
      onProgress("HUD 표시 복원 중");
      await displayToggle.beforeRestore?.();
      if (disposed) return;
      await refreshImages(source, tiles, "HUD 표시 복원 완료");
      hidden = false;
      logDiagnostic("REFRESH", "restore complete");
    } else {
      logDiagnostic("REFRESH", "hide start");
      onProgress("HUD 표시 숨기는 중");
      await refreshImages(
        hiddenSource ??= displayToggle.createHiddenSource(),
        tiles,
        "HUD 표시 숨김 완료",
      );
      hidden = true;
      logDiagnostic("REFRESH", "hide complete");
    }
  };
  const queueInput = (
    input: FastCanvasInput,
    fallback?: () => void | Promise<void>,
  ) => {
    if (disposed || (hidden && input !== "double-tap")) {
      logDiagnostic(
        "INPUT",
        `${input} ignored · ${disposed ? "disposed" : "hidden"}`,
      );
      return;
    }
    logDiagnostic("REFRESH", `input ${input} queued`);
    queueOperation(`input ${input}`, async () => {
      if (disposed) return;
      if (hidden) {
        if (input === "double-tap") await performDisplayToggle();
        return;
      }
      const result = await onInput?.(input) ?? "unhandled";
      logDiagnostic("INPUT", `${input} result · ${result}`);
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
    if (!externalRefresh || externalRefreshScheduled || disposed) {
      return;
    }
    externalRefreshScheduled = true;
    queueOperation("external refresh", async () => {
      try {
        const target = pendingRefreshTarget;
        pendingRefreshTarget = undefined;
        if (!target || hidden || disposed) {
          logDiagnostic(
            "REFRESH",
            `external refresh skipped · ${!target ? "empty" : hidden ? "hidden" : "disposed"}`,
          );
          return;
        }
        logDiagnostic("REFRESH", `external refresh start · ${target}`);
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
        logDiagnostic("REFRESH", `external refresh complete · ${target}`);
      } finally {
        externalRefreshScheduled = false;
        if (!disposed && pendingRefreshTarget) scheduleExternalRefresh();
      }
    });
  };
  const requestExternalRefresh: FastCanvasRefreshRequest = (target) => {
    if (disposed) {
      logDiagnostic("REFRESH", `external ${target} dropped · disposed`);
      return;
    }
    const previousTarget = pendingRefreshTarget;
    if (
      pendingRefreshTarget === "all"
      || target === "all"
      || (pendingRefreshTarget && pendingRefreshTarget !== target)
    ) {
      pendingRefreshTarget = "all";
    } else {
      pendingRefreshTarget = target;
    }
    logDiagnostic(
      "REFRESH",
      `external requested · ${target} → ${pendingRefreshTarget}`
        + (previousTarget ? ` · merged ${previousTarget}` : ""),
    );
    scheduleExternalRefresh();
  };

  let eventCount = 0;
  const sdkUnsubscribe = bridge.onEvenHubEvent((event) => {
    if (disposed) return;
    eventCount += 1;
    logDiagnostic(
      "INPUT",
      `raw #${eventCount} · hidden=${hidden}`
        + ` · sys=${event.sysEvent?.eventType ?? "omitted"}`
        + ` · text=${event.textEvent?.eventType ?? "omitted"}`
        + ` · source=${event.sysEvent?.eventSource ?? "omitted"}`,
    );
    try {
      onRawEvent?.(Object.freeze({
        count: eventCount,
        hidden,
        sysEventType: event.sysEvent?.eventType,
        textEventType: event.textEvent?.eventType,
        eventSource: event.sysEvent?.eventSource,
      }));
    } catch {
      // Phone-only diagnostics must not break glasses input.
    }
    const eventType = event.sysEvent
      ? event.sysEvent.eventType ?? OsEventTypeList.CLICK_EVENT
      : event.textEvent
        ? event.textEvent.eventType ?? OsEventTypeList.CLICK_EVENT
        : null;
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
