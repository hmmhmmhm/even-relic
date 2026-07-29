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
} from "./fast-canvas-hud";
import {
  getAdjacentFastHudPage,
  normalizeFastHudPage,
  type FastHudPage,
} from "./fast-hud-pages";
import { drawFastDetailHud } from "./fast-detail-hud";
import { paginateFastNewsSummary } from "./fast-news-pages";
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
import type { EvenStorage } from "./live-cache";
import {
  DEFAULT_PHONE_PREFERENCES,
  resolvePhonePreferences,
} from "./phone-preferences";
import type { PhonePreferences } from "./phone-types";
import { PhoneCompanion } from "./phone/PhoneCompanion";
import { resolveOrsKey } from "./ors-key";
import {
  DEFAULT_RSS_SOURCE,
  resolveRssSources,
  type RssSource,
} from "./rss-sources";

type AppProps = {
  autoStart?: boolean;
};

const diagnosticErrorKind = (error: unknown) => (
  error instanceof Error ? error.name : typeof error
);

function createBrowserStorage(): EvenStorage {
  return {
    async getLocalStorage(key) {
      return typeof localStorage === "undefined"
        ? ""
        : localStorage.getItem(key) ?? "";
    },
    async setLocalStorage(key, value) {
      if (typeof localStorage === "undefined") return false;
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
      return true;
    },
  };
}

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
  const [companionLive, setCompanionLive] = useState(
    createInitialLiveDashboardState,
  );
  const [companionBattery, setCompanionBattery] = useState<
    FastCanvasBattery | undefined
  >();
  const [companionStorage, setCompanionStorage] = useState<EvenStorage>(
    createBrowserStorage,
  );
  const [phonePreferences, setPhonePreferencesState] = useState<
    PhonePreferences
  >(DEFAULT_PHONE_PREFERENCES);
  const phonePreferencesRef = useRef<PhonePreferences>(
    DEFAULT_PHONE_PREFERENCES,
  );
  const [companionOrsKey, setCompanionOrsKeyState] = useState<string>();
  const companionOrsKeyRef = useRef<string | undefined>(undefined);
  const [companionRssSources, setCompanionRssSources] = useState<
    readonly RssSource[]
  >([DEFAULT_RSS_SOURCE]);

  const setPhonePreferences = (value: PhonePreferences) => {
    phonePreferencesRef.current = value;
    setPhonePreferencesState(value);
  };

  const setCompanionOrsKey = (value: string | undefined) => {
    companionOrsKeyRef.current = value;
    setCompanionOrsKeyState(value);
    liveSessionRef.current?.setRoutingKey?.(value);
  };

  useEffect(() => {
    if (!fastCanvasHudMode) return;
    let active = true;
    void resolvePhonePreferences(
      companionStorage,
      routingStatus.enabled,
    ).then((value) => {
      if (active) setPhonePreferences(value);
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode, routingStatus.enabled]);

  useEffect(() => {
    if (!fastCanvasHudMode) return;
    let active = true;
    void resolveOrsKey(companionStorage).then((value) => {
      if (active) setCompanionOrsKey(value);
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode]);

  useEffect(() => {
    if (!fastCanvasHudMode) return;
    let active = true;
    void resolveRssSources(companionStorage).then((value) => {
      if (active) setCompanionRssSources(value);
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode]);

  useEffect(() => {
    if (!autoStart || !canvasRef.current) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let liveSession: ReturnType<typeof createLiveDashboardSession> | undefined;
    let page: FastHudPage = HUD_PAGES[0];
    let view = createFastHudViewState();
    let battery: FastCanvasBattery | undefined;
    let live: LiveDashboardState = createInitialLiveDashboardState();
    let requestLiveRefresh: FastCanvasRefreshRequest | undefined;
    let stopMinuteRefresh: (() => void) | undefined;
    let lastSuccessfulDisplayMinute: number | undefined;
    let lastMinuteAttempt: number | undefined;
    let stopDiagnosticHeartbeat: (() => void) | undefined;
    let newsPageCacheKey = "";
    let newsPageCounts: readonly number[] = [];
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
      const news = live.news.value ?? [];
      const nextNewsPageCacheKey = [
        live.news.status,
        live.news.fetchedAt ?? "",
        news.length,
      ].join(":");
      if (nextNewsPageCacheKey !== newsPageCacheKey) {
        if (news.length === 0) {
          newsPageCounts = [];
        } else {
          const context = canvas.getContext("2d");
          newsPageCounts = context
            ? news.map((item) =>
                paginateFastNewsSummary(context, item.summary).length
              )
            : news.map(() => 1);
        }
        newsPageCacheKey = nextNewsPageCacheKey;
      }
      return {
        newsCount: news.length,
        newsPageCounts,
        todoCount: live.todos.value?.length ?? 0,
        maneuverCount: route?.maneuvers.length ?? 0,
        activeManeuverIndex: route?.activeManeuverIndex ?? 0,
      };
    };
    const currentMapRadius = () => FAST_MAP_ZOOM_RADII[view.zoomIndex];
    const drawCurrentPage = () => {
      if (fastCanvasHudMode) {
        page = normalizeFastHudPage(
          page,
          live.route.status,
          phonePreferencesRef.current,
        );
        if (
          view.mode === "navigation"
          && live.route.status === "disabled"
        ) {
          view = { ...view, mode: "weather" };
        }
      }
      view = syncFastHudView(view, viewContext());
      const mode = view.mode;
      if (fastCanvasHudMode && mode === "map") {
        drawFastFullscreenMap(canvas, live, currentMapRadius());
      } else if (
        fastCanvasHudMode
        && (
          mode === "news"
          || mode === "todo"
          || mode === "weather"
          || mode === "navigation"
        )
      ) {
        drawFastDetailHud(canvas, {
          mode,
          live,
          newsIndex: view.newsIndex,
          newsPage: view.newsPage,
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
      else drawDenseCanvasHud(canvas, new Date(), page as HudPage);
    };
    const requestVisibleRefresh = (target: FastCanvasRefreshTarget) => {
      if (!requestLiveRefresh) return;
      requestLiveRefresh(target);
    };
    const navigateCanvas = async (direction: "next" | "previous") => {
      page = fastCanvasHudMode
        ? getAdjacentFastHudPage(
            page,
            direction,
            live.route.status,
            phonePreferencesRef.current,
          )
        : getAdjacentHudPage(page as HudPage, direction);
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
              setCompanionBattery(nextBattery);
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
                const changed = await liveSession?.toggleTodo(
                  transition.effect.index,
                ) ?? false;
                if (!changed) return "consume";
                drawCurrentPage();
                return "redraw";
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
        if (
          typeof bridge.getLocalStorage === "function"
          && typeof bridge.setLocalStorage === "function"
        ) {
          setCompanionStorage(bridge);
        }
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
            setCompanionLive(update.state);
            view = syncFastHudView(view, viewContext());
            setCompanionRoute(update.state.route);
            if (refreshTarget) requestVisibleRefresh(refreshTarget);
          },
        });
        liveSession.setRoutingKey?.(companionOrsKeyRef.current);
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
        const startedState = liveSession.getState();
        if (startedState) {
          live = startedState;
          setCompanionLive(startedState);
        }
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
              formatHybridHudText(page as HudPage),
              report,
              async (direction) => {
                  page = getAdjacentHudPage(page as HudPage, direction);
                  return formatHybridHudText(page as HudPage);
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
  const effectiveRoutingStatus: RoutingStatus = {
    enabled: routingStatus.enabled || companionOrsKey !== undefined,
  };

  const hudSurface = (
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
      aria-label="SANDEVISTAN 이미지 전송 시안"
    >
      <canvas
        ref={canvasRef}
        width="576"
        height="288"
        role="img"
        aria-label="SANDEVISTAN HUD 안경 프레임"
      />
    </section>
  );

  if (fastCanvasHudMode) {
    return (
      <PhoneCompanion
        canvas={hudSurface}
        status={status}
        battery={companionBattery}
        live={companionLive}
        routingStatus={effectiveRoutingStatus}
        preferences={phonePreferences}
        storage={companionStorage}
        onPreferencesChange={setPhonePreferences}
        onTodosChange={(items) => {
          liveSessionRef.current?.replaceTodos?.(items);
          setCompanionLive((current) => ({
            ...current,
            todos: { status: "fresh", value: items },
          }));
        }}
        onWeatherRefresh={() => (
          liveSessionRef.current?.refreshWeather?.()
          ?? Promise.resolve("dropped")
        )}
        rssSources={companionRssSources}
        onRssSourcesChange={(sources) => {
          setCompanionRssSources(sources);
          void liveSessionRef.current?.refreshNewsSources?.();
        }}
        onOrsKeyChange={setCompanionOrsKey}
        onDeleteRoute={endCompanionRoute}
        routeControls={(
          <RouteControls
            status={effectiveRoutingStatus}
            orsKey={companionOrsKey}
            activeRoute={activeCompanionRoute}
            routeStatus={companionRoute.status}
            onStart={startCompanionRoute}
            onResume={resumeCompanionRoute}
            onEnd={endCompanionRoute}
          />
        )}
      />
    );
  }

  return (
    <main className="preview-stage">
      <header className="preview-header">
        <div>
          <strong>SANDEVISTAN / G2 RASTER TEST</strong>
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

      {hudSurface}

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
