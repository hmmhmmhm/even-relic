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
  type FastCanvasRefreshTarget,
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
import { drawFastDetailHud } from "./fast-detail-hud";
import { detailRefreshTarget } from "./fast-detail-refresh";
import { drawFastFullscreenMap } from "./fast-map";
import {
  FAST_MAP_ZOOM_RADII,
  createFastHudViewState,
  reduceFastHudInput,
  syncFastHudView,
  type FastHudViewContext,
} from "./fast-hud-view";
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
import { RouteControls } from "./RouteControls";
import { DiagnosticConsole } from "./DiagnosticConsole";
import {
  logDiagnostic,
  startDiagnosticHeartbeat,
} from "./diagnostic-log";
import {
  getRoutingStatus,
  type Destination,
  type RouteProfile,
  type RoutingStatus,
} from "./routing";

type AppProps = {
  autoStart?: boolean;
};

const diagnosticErrorKind = (error: unknown) => (
  error instanceof Error ? error.name : typeof error
);

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
  const liveSessionRef = useRef<
    ReturnType<typeof createLiveDashboardSession> | undefined
  >(undefined);
  const [status, setStatus] = useState(
    autoStart ? "HUD 이미지 준비 중" : "자동 전송 비활성",
  );
  const [routingStatus, setRoutingStatus] = useState<RoutingStatus>({
    enabled: false,
  });
  const [companionRoute, setCompanionRoute] = useState<
    LiveDashboardState["route"]
  >({ status: "disabled" });

  useEffect(() => {
    if (!autoStart || !canvasRef.current) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let liveSession: ReturnType<typeof createLiveDashboardSession> | undefined;
    let page: HudPage = HUD_PAGES[0];
    let view = createFastHudViewState();
    let battery: FastCanvasBattery | undefined;
    let live: LiveDashboardState = createInitialLiveDashboardState();
    let requestLiveRefresh: FastCanvasRefreshRequest | undefined;
    let stopMinuteRefresh: (() => void) | undefined;
    let lastSuccessfulDisplayMinute: number | undefined;
    let lastMinuteAttempt: number | undefined;
    let stopDiagnosticHeartbeat: (() => void) | undefined;
    const canvas = canvasRef.current;
    const onWindowError = (event: ErrorEvent) => {
      logDiagnostic(
        "ERROR",
        `window error · ${diagnosticErrorKind(event.error)}`,
      );
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      logDiagnostic(
        "ERROR",
        `unhandled rejection · ${diagnosticErrorKind(event.reason)}`,
      );
    };
    if (fastCanvasHudMode) {
      logDiagnostic("APP", "fast HUD effect start");
      stopDiagnosticHeartbeat = startDiagnosticHeartbeat();
      window.addEventListener("error", onWindowError);
      window.addEventListener("unhandledrejection", onUnhandledRejection);
    }
    const report = (message: string) => {
      if (!cancelled) setStatus(message);
    };
    const viewContext = (): FastHudViewContext => {
      const route = live.route.value;
      return {
        newsCount: live.news.value?.length ?? 0,
        todoCount: live.todos.value?.length ?? 0,
        maneuverCount: route?.maneuvers.length ?? 0,
        activeManeuverIndex: route?.activeManeuverIndex ?? 0,
      };
    };
    const currentMapRadius = () => FAST_MAP_ZOOM_RADII[view.zoomIndex];
    const drawCurrentPage = () => {
      view = syncFastHudView(view, viewContext());
      const mode = view.mode;
      if (fastCanvasHudMode && mode === "map") {
        drawFastFullscreenMap(canvas, live, currentMapRadius());
      } else if (
        fastCanvasHudMode
        && (mode === "news" || mode === "todo" || mode === "navigation")
      ) {
        drawFastDetailHud(canvas, {
          mode,
          live,
          newsIndex: view.newsIndex,
          todoIndex: view.todoIndex,
          navigationIndex: view.navigationIndex,
        });
      } else if (fastCanvasHudMode) {
        drawFastCanvasHud(canvas, new Date(), page, {
          battery,
          live,
          mapRadiusMeters: currentMapRadius(),
        });
      }
      else drawDenseCanvasHud(canvas, new Date(), page);
    };
    const requestVisibleRefresh = (target: FastCanvasRefreshTarget) => {
      if (!requestLiveRefresh) return;
      requestLiveRefresh(target);
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
        logDiagnostic("APP", "transport start");
        const transportCleanup = await transmitFastCanvas(
          canvas,
          report,
          navigateCanvas,
          {
            beforeExternalRefresh: drawCurrentPage,
            beforeRestore: drawCurrentPage,
            onBattery: (nextBattery) => {
              battery = nextBattery;
              logDiagnostic(
                "APP",
                nextBattery
                  ? `battery ${nextBattery.label}`
                    + ` · level ${nextBattery.level ?? "unknown"}`
                    + ` · charging ${nextBattery.charging ?? "unknown"}`
                  : "battery unavailable",
              );
              if (
                requestLiveRefresh
                && page === "overview"
                && view.mode === "dashboard"
              ) {
                requestVisibleRefresh("right-top");
              } else if (!requestLiveRefresh) {
                drawCurrentPage();
              }
            },
            onDisplayCommitted: (minute) => {
              lastSuccessfulDisplayMinute = minute;
              logDiagnostic(
                "REFRESH",
                `display committed · minute ${minute}`,
              );
            },
            onInput: async (input) => {
              const previousMode = view.mode;
              const transition = reduceFastHudInput(
                view,
                page,
                input,
                viewContext(),
              );
              view = transition.state;
              logDiagnostic(
                "INPUT",
                `app ${input} · ${transition.result}`
                  + (transition.effect
                    ? ` · effect ${transition.effect.type}`
                    : ""),
              );
              if (transition.effect?.type === "toggle-todo") {
                await liveSession?.toggleTodo(transition.effect.index);
                return transition.result;
              }
              if (transition.result === "redraw") drawCurrentPage();
              if (
                previousMode === "news"
                && view.mode !== "news"
              ) {
                liveSession?.refreshNewsIfDue?.();
              }
              return transition.result;
            },
            onRawEvent: (event) => {
              if (!event.hidden) return;
              const field = (value: number | undefined) => value ?? "-";
              report(
                `숨김 입력 #${event.count}`
                  + ` · SYS ${field(event.sysEventType)}`
                  + ` · TEXT ${field(event.textEventType)}`
                  + ` · SRC ${field(event.eventSource)}`,
              );
            },
            onRefreshReady: (request) => {
              if (cancelled) return;
              requestLiveRefresh = request;
              logDiagnostic("APP", "transport refresh ready");
              stopMinuteRefresh ??= startMinuteRefresh(
                (minute) => {
                  if (lastMinuteAttempt === minute) return;
                  lastMinuteAttempt = minute;
                  if (view.mode !== "news") {
                    liveSession?.refreshNewsIfDue?.();
                  } else {
                    logDiagnostic("LIVE", "news refill skipped · reading");
                  }
                  if (lastSuccessfulDisplayMinute === minute) {
                    logDiagnostic(
                      "TIMER",
                      "minute refresh skipped · already rendered",
                    );
                    return;
                  }
                  logDiagnostic(
                    "TIMER",
                    `minute refresh · mode ${view.mode}`,
                  );
                  if (view.mode === "dashboard") {
                    requestVisibleRefresh("right-top");
                  }
                },
              );
            },
          },
        );
        logDiagnostic("APP", "transport ready");
        if (cancelled) {
          logDiagnostic("APP", "transport ready after cleanup");
          transportCleanup();
          return;
        }
        unsubscribe = transportCleanup;
        logDiagnostic("APP", "live bridge wait");
        const [bridge, nextRoutingStatus] = await Promise.all([
          waitForEvenAppBridge(),
          getRoutingStatus().catch(() => ({ enabled: false })),
        ]);
        if (cancelled) return;
        logDiagnostic(
          "APP",
          `live bridge ready · routing ${
            nextRoutingStatus.enabled ? "enabled" : "disabled"
          }`,
        );
        setRoutingStatus(nextRoutingStatus);
        setCompanionRoute(nextRoutingStatus.enabled
          ? { status: "fresh" }
          : { status: "disabled" });
        liveSession = createLiveDashboardSession({
          bridge,
          routingStatus: nextRoutingStatus,
          canRefreshNews: () => view.mode !== "news",
          onUpdate: (update) => {
            if (cancelled) return;
            const refreshTarget = detailRefreshTarget(
              view.mode,
              live,
              update.state,
              update.target,
            );
            logDiagnostic(
              "LIVE",
              `app update · ${update.target}`
                + ` · visible ${refreshTarget ?? "none"}`,
            );
            live = update.state;
            view = syncFastHudView(view, viewContext());
            setCompanionRoute(update.state.route);
            if (refreshTarget) requestVisibleRefresh(refreshTarget);
          },
        });
        liveSessionRef.current = liveSession;
        if (cancelled) {
          liveSession.dispose();
          if (liveSessionRef.current === liveSession) {
            liveSessionRef.current = undefined;
          }
          liveSession = undefined;
          return;
        }
        logDiagnostic("APP", "live session start");
        await liveSession.start();
        logDiagnostic("APP", "live session ready");
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
      if (fastCanvasHudMode) {
        logDiagnostic(
          "ERROR",
          `app startup failed · ${diagnosticErrorKind(error)}`,
        );
      }
      report(error instanceof Error ? error.message : String(error));
    });

    return () => {
      if (fastCanvasHudMode) {
        logDiagnostic("APP", "fast HUD effect cleanup");
      }
      cancelled = true;
      stopMinuteRefresh?.();
      liveSession?.dispose();
      if (liveSessionRef.current === liveSession) {
        liveSessionRef.current = undefined;
      }
      unsubscribe?.();
      if (fastCanvasHudMode) {
        window.removeEventListener("error", onWindowError);
        window.removeEventListener(
          "unhandledrejection",
          onUnhandledRejection,
        );
        stopDiagnosticHeartbeat?.();
      }
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

  const startCompanionRoute = async (
    destination: Destination,
    profile: RouteProfile,
  ) => {
    const session = liveSessionRef.current;
    if (!session) throw new Error("길찾기 세션이 아직 준비되지 않았습니다.");
    await session.startRoute(destination, profile);
  };

  const endCompanionRoute = async () => {
    const session = liveSessionRef.current;
    if (!session) throw new Error("길찾기 세션이 아직 준비되지 않았습니다.");
    await session.endRoute();
  };

  const resumeCompanionRoute = async () => {
    const session = liveSessionRef.current;
    if (!session) throw new Error("길찾기 세션이 아직 준비되지 않았습니다.");
    await session.resumeRoute();
  };

  const activeCompanionRoute = companionRoute.status === "fresh"
    || companionRoute.status === "stale"
    || companionRoute.status === "loading"
    ? companionRoute.value
    : undefined;

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
      {fastCanvasHudMode && <DiagnosticConsole />}
      {fastCanvasHudMode && (
        <RouteControls
          status={routingStatus}
          activeRoute={activeCompanionRoute}
          routeStatus={companionRoute.status}
          onStart={startCompanionRoute}
          onResume={resumeCompanionRoute}
          onEnd={endCompanionRoute}
        />
      )}
    </main>
  );
}
