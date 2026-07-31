import { useEffect } from "react";
import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import {
  drawDenseCanvasHud,
  getAdjacentHudPage,
  HUD_PAGES,
  type HudPage,
} from "./canvas-hud";
import {
  logDiagnostic,
  startDiagnosticHeartbeat,
} from "./diagnostic-log";
import { drawFastCanvasHud } from "./fast-canvas-hud";
import { drawFastDetailHud } from "./fast-detail-hud";
import { detailRefreshTarget } from "./fast-detail-refresh";
import {
  getAdjacentFastHudPage,
  normalizeFastHudPage,
  type FastHudPage,
} from "./fast-hud-pages";
import { drawFastFullscreenMap } from "./fast-map";
import {
  FAST_MAP_ZOOM_RADII,
  createFastHudViewState,
  reduceFastHudInput,
  syncFastHudView,
  type FastHudViewContext,
} from "./fast-hud-view";
import { paginateFastNewsSummary } from "./fast-news-pages";
import {
  transmitFastCanvas,
  type FastCanvasBattery,
  type FastCanvasRefreshRequest,
  type FastCanvasRefreshTarget,
} from "./glasses";
import {
  prepareInitialHud,
  transmitLegacyHud,
} from "./legacy-hud-controller";
import { createLiveDashboardSession } from "./live-dashboard";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";
import { startMinuteRefresh } from "./minute-refresh";
import type { UseHudControllerOptions } from "./hud-controller-types";
import { resolvePhoneLocale } from "./phone-i18n";
import { getRoutingStatus } from "./routing";
type LiveSession = ReturnType<typeof createLiveDashboardSession>;
const diagnosticErrorKind = (error: unknown) => (
  error instanceof Error ? error.name : typeof error
);
export function useHudController({
  autoStart,
  canvasRef,
  liveSessionRef,
  phonePreferencesRef,
  displayRefreshRef,
  companionOrsKeyRef,
  displayHideStrategy,
  imageSendConcurrency,
  tileImageFormat,
  tilePaletteMode,
  modes,
  setStatus,
  setRoutingStatus,
  setCompanionRoute,
  setCompanionLive,
  setCompanionBattery,
  setCompanionStorage,
}: UseHudControllerOptions) {
  useEffect(() => {
    if (!autoStart || !canvasRef.current) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let liveSession: LiveSession | undefined;
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
    if (modes.fastCanvas) {
      logDiagnostic("APP", "fast HUD effect start");
      stopDiagnosticHeartbeat = startDiagnosticHeartbeat();
      window.addEventListener("error", onWindowError);
      window.addEventListener("unhandledrejection", onUnhandledRejection);
    }
    const report = (message: string) => { if (!cancelled) setStatus(message); };
    const currentLocale = () => resolvePhoneLocale(
      phonePreferencesRef.current.locale,
      typeof navigator === "undefined" ? "en" : navigator.language,
    );
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
                paginateFastNewsSummary(
                  context,
                  item.summary,
                  currentLocale(),
                ).length
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
      if (modes.fastCanvas) {
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
      const locale = currentLocale();
      if (modes.fastCanvas && mode === "map") {
        drawFastFullscreenMap(canvas, live, currentMapRadius(), locale);
      } else if (
        modes.fastCanvas
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
        }, locale);
      } else if (modes.fastCanvas) {
        drawFastCanvasHud(canvas, new Date(), page, {
          battery,
          live,
          mapRadiusMeters: currentMapRadius(),
        }, locale);
      } else {
        drawDenseCanvasHud(canvas, new Date(), page as HudPage);
      }
    };
    const requestVisibleRefresh = (target: FastCanvasRefreshTarget) => {
      requestLiveRefresh?.(target);
    };
    const navigateCanvas = async (direction: "next" | "previous") => {
      page = modes.fastCanvas
        ? getAdjacentFastHudPage(
            page,
            direction,
            live.route.status,
            phonePreferencesRef.current,
          )
        : getAdjacentHudPage(page as HudPage, direction);
      drawCurrentPage();
    };
    void (async () => {
      await prepareInitialHud(canvas, modes, drawCurrentPage);
      report("Even 앱 브리지 연결 대기 중 · Safari에서는 미리보기만 표시됩니다");
      if (modes.fastCanvas) {
        logDiagnostic(
          "APP",
          `transport start · pipeline ${imageSendConcurrency}`
            + ` · palette ${tilePaletteMode}`
            + ` · format ${tileImageFormat}`
            + ` · hide ${displayHideStrategy}`,
        );
        const transportCleanup = await transmitFastCanvas(
          canvas,
          report,
          navigateCanvas,
          {
            beforeExternalRefresh: drawCurrentPage,
            beforeRestore: drawCurrentPage,
            displayHideStrategy,
            imageSendConcurrency,
            tileImageFormat,
            tilePaletteMode,
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
              if (previousMode === "news" && view.mode !== "news") {
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
              displayRefreshRef.current = () => {
                drawCurrentPage();
                requestVisibleRefresh("all");
              };
              logDiagnostic("APP", "transport refresh ready");
              stopMinuteRefresh ??= startMinuteRefresh((minute) => {
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
              });
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
          getLocale: currentLocale,
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
      unsubscribe = await transmitLegacyHud(
        canvas,
        modes,
        report,
        navigateCanvas,
      );
    })().catch((error: unknown) => {
      if (modes.fastCanvas) {
        logDiagnostic(
          "ERROR",
          `app startup failed · ${diagnosticErrorKind(error)}`,
        );
      }
      report(error instanceof Error ? error.message : String(error));
    });

    return () => {
      if (modes.fastCanvas) {
        logDiagnostic("APP", "fast HUD effect cleanup");
      }
      cancelled = true;
      stopMinuteRefresh?.();
      displayRefreshRef.current = undefined;
      liveSession?.dispose();
      if (liveSessionRef.current === liveSession) {
        liveSessionRef.current = undefined;
      }
      unsubscribe?.();
      if (modes.fastCanvas) {
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
    canvasRef,
    companionOrsKeyRef,
    displayHideStrategy,
    displayRefreshRef,
    imageSendConcurrency,
    tileImageFormat,
    tilePaletteMode,
    liveSessionRef,
    modes.calibration,
    modes.canvas,
    modes.diagnostic,
    modes.fastCanvas,
    modes.hardwareBmp,
    modes.hybrid,
    modes.layeredHybrid,
    modes.legacyCanvas,
    phonePreferencesRef,
    setCompanionBattery,
    setCompanionLive,
    setCompanionRoute,
    setCompanionStorage,
    setRoutingStatus,
    setStatus,
  ]);
}
