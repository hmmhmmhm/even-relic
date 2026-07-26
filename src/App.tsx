import { useEffect, useRef, useState } from "react";
import hudReferenceUrl from "../docs/design/selected-peripheral-focus.png";
import {
  drawHudReference,
  transmitCanvas,
  transmitHardwareBmp,
  transmitHybridCanvas,
  transmitLayeredHybridCanvas,
  transmitOfficialSample,
} from "./glasses";
import { drawCalibrationPattern } from "./calibration";
import {
  drawDenseCanvasHud,
  getAdjacentHudPage,
  HUD_PAGES,
  type HudPage,
} from "./canvas-hud";
import {
  drawHybridHudBackground,
  drawLayeredHybridHudBackground,
  formatHybridHudText,
} from "./hybrid-hud";

type AppProps = {
  autoStart?: boolean;
};

export function App({ autoStart = true }: AppProps) {
  const calibrationMode = window.location.pathname === "/calibration-max";
  const canvasHudMode = window.location.pathname === "/hud-canvas";
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
    let page: HudPage = HUD_PAGES[0];
    const canvas = canvasRef.current;
    const report = (message: string) => {
      if (!cancelled) setStatus(message);
    };
    const drawCurrentPage = () => {
      drawDenseCanvasHud(canvas, new Date(), page);
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
              canvasHudMode
                ? async (direction) => {
                    page = getAdjacentHudPage(page, direction);
                    drawCurrentPage();
                  }
                : undefined,
            );
    })().catch((error: unknown) => {
      report(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [
    autoStart,
    calibrationMode,
    canvasHudMode,
    diagnosticMode,
    hardwareBmpMode,
    hybridHudMode,
    layeredHybridHudMode,
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
                      : canvasHudMode
                        ? "576×288 · CANVAS HUD · SCROLL · 4 PAGES"
                        : "576×288 · 4 IMAGE TILES"}
            {" · STATIC MOCK"}
          </span>
        </div>
        <output aria-live="polite">{status}</output>
      </header>

      <section
        className="hud-frame"
        data-testid="hud-frame"
        data-logical-size="576x288"
        data-renderer={
          layeredHybridHudMode
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
          layeredHybridHudMode ? "map-text-console" : undefined
        }
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
                  : canvasHudMode
                    ? "기본 뉴스 화면에서 아래 스크롤은 다음, 위 스크롤은 이전 페이지를 네 타일로 전송합니다."
                    : "이 Canvas가 네 장의 PNG로 나뉘어 안경에 순차 전송됩니다."}
      </p>
    </main>
  );
}
