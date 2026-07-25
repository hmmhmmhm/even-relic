import { useEffect, useRef, useState } from "react";
import appManifest from "../app.json";
import hudReferenceUrl from "../docs/design/selected-peripheral-focus.png";
import {
  drawHudReference,
  transmitCanvas,
  transmitHardwareBmp,
  transmitOfficialSample,
} from "./glasses";

type AppProps = {
  autoStart?: boolean;
};

const DIAGNOSTIC_BUILD = "png8-1";

export function App({ autoStart = true }: AppProps) {
  const hardwareBmpMode = window.location.pathname === "/diagnostic-v10";
  const diagnosticMode = window.location.pathname.startsWith("/diagnostic-v")
    || new URLSearchParams(window.location.search).get("mode") === "diagnostic";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initialStatus = autoStart ? "HUD 이미지 준비 중" : "자동 전송 비활성";
  const [statusLog, setStatusLog] = useState([initialStatus]);

  useEffect(() => {
    if (!autoStart || !canvasRef.current) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const report = (message: string) => {
      if (!cancelled) {
        setStatusLog((current) => [...current, message]);
      }
    };

    void (async () => {
      await drawHudReference(canvasRef.current!, hudReferenceUrl);
      report("Even 앱 브리지 연결 대기 중 · Safari에서는 미리보기만 표시됩니다");
      unsubscribe = hardwareBmpMode
        ? await transmitHardwareBmp(report)
        : diagnosticMode
          ? await transmitOfficialSample(report)
          : await transmitCanvas(canvasRef.current!, report);
    })().catch((error: unknown) => {
      report(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [autoStart, diagnosticMode, hardwareBmpMode]);

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
                : "576×288 · 4 IMAGE TILES"}
            {" · STATIC MOCK"}
          </span>
          <small className="build-version">
            {`v${appManifest.version} · ${DIAGNOSTIC_BUILD}`}
          </small>
        </div>
        <output aria-live="polite" data-testid="status-log">
          {statusLog.map((message, index) => (
            <span key={`${index}-${message}`}>{message}</span>
          ))}
        </output>
      </header>

      <section
        className="hud-frame"
        data-testid="hud-frame"
        data-logical-size="576x288"
        data-text-containers={diagnosticMode ? "2" : "1"}
        data-image-containers={diagnosticMode ? "1" : "4"}
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
            : "이 Canvas가 네 장의 PNG로 나뉘어 안경에 순차 전송됩니다."}
      </p>
    </main>
  );
}
