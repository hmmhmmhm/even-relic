import { useEffect, useRef, useState } from "react";
import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import hudReferenceUrl from "../docs/design/selected-peripheral-focus.png";
import {
  drawHudReference,
  transmitCanvas,
  transmitFastCanvas,
  transmitHardwareBmp,
  transmitHybridCanvas,
  transmitLayeredHybridCanvas,
  transmitOfficialSample,
  type FastCanvasBattery,
  type FastCanvasRefreshRequest,
} from "./glasses";
import { drawCalibrationPattern } from "./calibration";
import {
  drawDenseCanvasHud,
  getAdjacentHudPage,
  HUD_PAGES,
  type HudPage,
} from "./canvas-hud";
import {
  drawFastCanvasHud,
  getAdjacentFastHudPage,
} from "./fast-canvas-hud";
import {
  drawHybridHudBackground,
  drawLayeredHybridHudBackground,
  formatHybridHudText,
} from "./hybrid-hud";
import { createLiveDashboardSession } from "./live-dashboard";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";
import { startMinuteRefresh } from "./minute-refresh";

type AppProps = {
  autoStart?: boolean;
};

export function App({ autoStart = true }: AppProps) {
  const calibrationMode = window.location.pathname === "/calibration-max";
  const legacyCanvasHudMode = window.location.pathname === "/hud-canvas";
  const fastCanvasHudMode = window.location.pathname === "/hud-canvas-fast";
  const canvasHudMode = legacyCanvasHudMode || fastCanvasHudMode;
  const legacyHybridHudMode = window.location.pathname === "/hud-hybrid";
  const layeredHybridHudMode = window.location.pathname === "/hud-hybrid-z";
  const hybridHudMode = legacyHybridHudMode || layeredHybridHudMode;
  const hardwareBmpMode = window.location.pathname === "/diagnostic-v10";
  const diagnosticMode = window.location.pathname.startsWith("/diagnostic-v")
    || new URLSearchParams(window.location.search).get("mode") === "diagnostic";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState(
    autoStart ? "HUD 이미지 준비 중" : "자동 전송 비활성",
  );

  useEffect(() => {
    if (!autoStart || !canvasRef.current) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let liveSession: ReturnType<typeof createLiveDashboardSession> | undefined;
    let page: HudPage = HUD_PAGES[0];
    let battery: FastCanvasBattery | undefined;
    let live: LiveDashboardState = createInitialLiveDashboardState();
    let requestLiveRefresh: FastCanvasRefreshRequest | undefined;
    let stopMinuteRefresh: (() => void) | undefined;
    const canvas = canvasRef.current;
    const report = (message: string) => {
      if (!cancelled) setStatus(message);
    };
    const drawCurrentPage = () => {
      if (fastCanvasHudMode) {
        drawFastCanvasHud(canvas, new Date(), page, { battery, live });
      }
      else drawDenseCanvasHud(canvas, new Date(), page);
    };
    const navigateCanvas = async (direction: "next" | "previous") => {
      page = fastCanvasHudMode
        ? getAdjacentFastHudPage(page, direction)
        : getAdjacentHudPage(page, direction);
      drawCurrentPage();
    };
    const transmitHybrid = layeredHybridHudMode
      ? transmitLayeredHybridCanvas
      : transmitHybridCanvas;

    void (async () => {
      if (calibrationMode) {
        drawCalibrationPattern(canvas);
      } else if (canvasHudMode) {
        drawCurrentPage();
      } else if (hybridHudMode) {
        if (layeredHybridHudMode) drawLayeredHybridHudBackground(canvas);
        else drawHybridHudBackground(canvas);
      } else {
        await drawHudReference(canvas, hudReferenceUrl);
      }
      report("Even 앱 브리지 연결 대기 중 · Safari에서는 미리보기만 표시됩니다");
      if (fastCanvasHudMode) {
        const transportCleanup = await transmitFastCanvas(
          canvas,
          report,
          navigateCanvas,
          {
            beforeExternalRefresh: drawCurrentPage,
            beforeRestore: drawCurrentPage,
            onBattery: (nextBattery) => {
              battery = nextBattery;
              drawCurrentPage();
            },
            onRefreshReady: (request) => {
              if (cancelled) return;
              requestLiveRefresh = request;
              stopMinuteRefresh ??= startMinuteRefresh(
                () => requestLiveRefresh?.("right-top"),
              );
            },
          },
        );
        if (cancelled) {
          transportCleanup();
          return;
        }
        unsubscribe = transportCleanup;
        const bridge = await waitForEvenAppBridge();
        if (cancelled) return;
        liveSession = createLiveDashboardSession({
          bridge,
          onUpdate: (update) => {
            if (cancelled) return;
            live = update.state;
            requestLiveRefresh?.(update.target);
          },
        });
        if (cancelled) {
          liveSession.dispose();
          liveSession = undefined;
          return;
        }
        await liveSession.start();
        return;
      }
      unsubscribe = hardwareBmpMode
        ? await transmitHardwareBmp(report)
        : diagnosticMode
          ? await transmitOfficialSample(report)
          : hybridHudMode
            ? await transmitHybrid(
                canvas,
                formatHybridHudText(page),
                report,
                async (direction) => {
                  page = getAdjacentHudPage(page, direction);
                  return formatHybridHudText(page);
                },
              )
          : await transmitCanvas(
              canvas,
              report,
              undefined,
              undefined,
              legacyCanvasHudMode ? navigateCanvas : undefined,
            );
    })().catch((error: unknown) => {
      report(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
      stopMinuteRefresh?.();
      liveSession?.dispose();
      unsubscribe?.();
    };
  }, [
    autoStart,
    calibrationMode,
    canvasHudMode,
    diagnosticMode,
    fastCanvasHudMode,
    hardwareBmpMode,
    hybridHudMode,
    layeredHybridHudMode,
    legacyCanvasHudMode,
  ]);

  return (
    <main className="preview-stage">
      <header className="preview-header">
        <div>
          <strong>RELIC / G2 RASTER TEST</strong>
          <span>
            {hardwareBmpMode
              ? "1-BIT BMP · CLICK TO SEND"
              : diagnosticMode
                ? "OFFICIAL SAMPLE.PNG · RAW BYTES"
                : calibrationMode
                  ? "576×288 MAX BOUNDARY"
                  : layeredHybridHudMode
                    ? "STATIC CANVAS + NATIVE TEXT + Z-ORDER · SCROLL · 4 PAGES"
                    : hybridHudMode
                      ? "STATIC CANVAS + NATIVE TEXT · SCROLL · 4 PAGES"
                      : fastCanvasHudMode
                        ? "576×288 · CANVAS HUD · FAST 2-TILE · SCROLL · 4 PAGES · LIVE DATA"
                        : canvasHudMode
                          ? "576×288 · CANVAS HUD · SCROLL · 4 PAGES"
                          : "576×288 · 4 IMAGE TILES"}
            {!fastCanvasHudMode && " · STATIC MOCK"}
          </span>
        </div>
        <output aria-live="polite">{status}</output>
      </header>

      <section
        className="hud-frame"
        data-testid="hud-frame"
        data-logical-size="576x288"
        data-renderer={
          fastCanvasHudMode
            ? "canvas-fast"
            : layeredHybridHudMode
              ? "hybrid-z"
              : hybridHudMode
                ? "hybrid"
                : canvasHudMode
                  ? "canvas"
                  : calibrationMode
                    ? "calibration"
                    : "image"
        }
        data-layering={layeredHybridHudMode ? "explicit" : undefined}
        data-layout={
          fastCanvasHudMode
            ? "static-left-dynamic-right"
            : layeredHybridHudMode
              ? "map-text-console"
              : undefined
        }
        data-update-tiles={fastCanvasHudMode ? "2" : undefined}
        data-text-containers={diagnosticMode ? "2" : "1"}
        data-image-containers={diagnosticMode ? "1" : "4"}
        data-pages={
          canvasHudMode || hybridHudMode ? HUD_PAGES.length : undefined
        }
        aria-label="RELIC 이미지 전송 시안"
      >
        <canvas
          ref={canvasRef}
          width="576"
          height="288"
          role="img"
          aria-label="RELIC HUD 안경 프레임"
        />
      </section>

      <p className="preview-note">
        {hardwareBmpMode
          ? "안경에 준비 문구를 표시한 뒤 링/터치바를 클릭하면 200×100 1-bit BMP를 전송합니다."
          : diagnosticMode
            ? "진단 모드에서는 Even Realities 공식 sample.png 원본 바이트를 그대로 전송합니다."
            : calibrationMode
              ? "외곽 띠, 보조 테두리, 중앙 십자와 32px 눈금을 네 타일로 전송합니다."
              : layeredHybridHudMode
                ? "Canvas 배경 위에 명시적 최상위 레이어의 네이티브 Text를 표시합니다."
                : hybridHudMode
                  ? "Canvas에는 정적 배경만 보이며, 실제 안경 문구는 네이티브 Text로 한 번에 전환됩니다."
                  : fastCanvasHudMode
                    ? "날씨: Open-Meteo · 지도 데이터: OpenStreetMap contributors · 뉴스: SBS RSS · 개인·비상업"
                    : canvasHudMode
                      ? "기본 뉴스 화면에서 아래 스크롤은 다음, 위 스크롤은 이전 페이지를 네 타일로 전송합니다."
                      : "이 Canvas가 네 장의 PNG로 나뉘어 안경에 순차 전송됩니다."}
      </p>
    </main>
  );
}
