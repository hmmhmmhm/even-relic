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

const bytesEqual = (
  left: Uint8Array | undefined,
  right: Uint8Array,
) => {
  if (!left || left.length !== right.length) return false;
  for (let index = 0; index < right.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const TILE_SEND_TIMEOUT_MS = 12_000;

function waitForTileSend<T>(
  promise: Promise<T>,
  tileName: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      logDiagnostic(
        "ERROR",
        `${tileName} timeout · ${TILE_SEND_TIMEOUT_MS}ms`,
      );
      reject(new Error(
        `${tileName} 전송 제한 시간 초과: ${TILE_SEND_TIMEOUT_MS}ms`,
      ));
    }, TILE_SEND_TIMEOUT_MS);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
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
  onRawEvent?: (event: FastCanvasRawEvent) => void,
  onDisplayCommitted?: () => void,
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

  const lastSuccessfulTilePayload = new Map<number, Uint8Array>();
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
    let sentCount = 0;
    let skippedCount = 0;
    await sendTilesSequentially(encodedTiles, async (bytes, index) => {
      if (!shouldContinue()) return;
      const tile = targetTiles[index];
      if (bytesEqual(lastSuccessfulTilePayload.get(tile.id), bytes)) {
        skippedCount += 1;
        logDiagnostic("TILE", `${tile.name} skipped · unchanged`);
        return;
      }
      const tileStartedAt = diagnosticNow();
      logDiagnostic(
        "TILE",
        `${tile.name} start · ${index + 1}/${targetTiles.length}`,
      );
      let result: ImageRawDataUpdateResult;
      try {
        result = ImageRawDataUpdateResult.normalize(
          await waitForTileSend(
            bridge.updateImageRawData(new ImageRawDataUpdate({
              containerID: tile.id,
              containerName: tile.name,
              imageData: bytes,
            })),
            tile.name,
          ),
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
      lastSuccessfulTilePayload.set(tile.id, bytes.slice());
      sentCount += 1;
      onProgress(`안경 이미지 전송 중 ${index + 1}/${targetTiles.length}`);
    });
    if (!shouldContinue()) return;
    logDiagnostic(
      "REFRESH",
      `image refresh complete · sent ${sentCount} · skipped ${skippedCount}`,
    );
    onProgress(completionMessage);
    try {
      onDisplayCommitted?.();
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `display commit callback failed · ${diagnosticError(error)}`,
      );
    }
  };

  await refreshImages(source, tiles, "안경 전송 완료");
  let disposed = false;
  let hidden = false;
  let hiddenSource: HTMLCanvasElement | undefined;
  let busy = false;
  const startOperation = (
    label: string,
    operation: () => void | Promise<void>,
  ): boolean => {
    if (disposed || busy) {
      logDiagnostic(
        "REFRESH",
        `${label} dropped · ${disposed ? "disposed" : "busy"}`,
      );
      return false;
    }
    busy = true;
    const startedAt = diagnosticNow();
    logDiagnostic("REFRESH", `${label} accepted`);
    void (async () => operation())()
      .catch((error: unknown) => {
        logDiagnostic(
          "ERROR",
          `${label} failed · ${diagnosticError(error)}`,
          diagnosticDuration(startedAt),
        );
        onProgress(diagnosticError(error));
      })
      .finally(() => {
        busy = false;
        logDiagnostic(
          "REFRESH",
          `${label} complete`,
          diagnosticDuration(startedAt),
        );
      });
    return true;
  };
  const performNavigation = async (direction: PageDirection) => {
    if (!onNavigate || hidden || disposed) return;
    onProgress("HUD 페이지 전환 중");
    logDiagnostic("REFRESH", `page ${direction} prepare`);
    await onNavigate(direction);
    if (disposed) return;
    try {
      await refreshImages(source, navigationTiles, "페이지 전송 완료");
      logDiagnostic("REFRESH", `page ${direction} commit`);
    } catch (error) {
      const rollbackDirection = direction === "next" ? "previous" : "next";
      try {
        await onNavigate(rollbackDirection);
        logDiagnostic(
          "REFRESH",
          `page ${direction} rollback · ${rollbackDirection}`,
        );
      } catch (rollbackError) {
        logDiagnostic(
          "ERROR",
          `page ${direction} rollback failed · ${
            diagnosticError(rollbackError)
          }`,
        );
      }
      throw error;
    }
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
  const handleInput = (
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
    startOperation(`input ${input}`, async () => {
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
  const requestExternalRefresh: FastCanvasRefreshRequest = (target) => {
    if (!externalRefresh || disposed || hidden || busy) {
      const reason = !externalRefresh
        ? "unavailable"
        : disposed
          ? "disposed"
          : hidden
            ? "hidden"
            : "busy";
      logDiagnostic(
        "REFRESH",
        `external ${target} dropped · ${reason}`,
      );
      return;
    }
    startOperation(`external ${target}`, async () => {
      onProgress("라이브 HUD 갱신 중");
      await externalRefresh.beforeExternalRefresh?.();
      if (hidden || disposed) return;
      await refreshImages(
        source,
        externalRefresh.targetTiles[target],
        "라이브 HUD 갱신 완료",
        () => !disposed && !hidden,
      );
    });
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
      handleInput("tap");
    } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      handleInput("double-tap", performDisplayToggle);
    } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      handleInput("scroll-next", () => performNavigation("previous"));
    } else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      handleInput("scroll-previous", () => performNavigation("next"));
    }
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
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
