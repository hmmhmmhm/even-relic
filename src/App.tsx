import { useEffect, useRef, useState } from "react";
import { HUD_PAGES } from "./canvas-hud";
import { useHudController } from "./fast-hud-controller";
import type { HudControllerModes } from "./hud-controller-types";
import type { FastCanvasBattery } from "./glasses";
import { createLiveDashboardSession } from "./live-dashboard";
import type { EvenStorage } from "./live-cache";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";
import { resolveOrsKey } from "./ors-key";
import {
  resolvePhoneLocale,
  translatePhone,
} from "./phone-i18n";
import {
  DEFAULT_PHONE_PREFERENCES,
  resolvePhonePreferences,
} from "./phone-preferences";
import type { PhonePreferences } from "./phone-types";
import { PhoneCompanion } from "./phone/PhoneCompanion";
import {
  defaultRssSources,
  resolveRssSources,
  type RssSource,
} from "./rss-sources";
import { localizeBuiltInTodos } from "./todos";
import { RouteControls } from "./RouteControls";
import type {
  Destination,
  RouteProfile,
  RoutingStatus,
} from "./routing";

type AppProps = {
  autoStart?: boolean;
};

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
  const modes: HudControllerModes = {
    calibration: calibrationMode,
    canvas: canvasHudMode,
    diagnostic: diagnosticMode,
    fastCanvas: fastCanvasHudMode,
    hardwareBmp: hardwareBmpMode,
    hybrid: hybridHudMode,
    layeredHybrid: layeredHybridHudMode,
    legacyCanvas: legacyCanvasHudMode,
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveSessionRef = useRef<
    ReturnType<typeof createLiveDashboardSession> | undefined
  >(undefined);
  const displayRefreshRef = useRef<(() => void) | undefined>(undefined);
  const [status, setStatus] = useState(
    autoStart ? "HUD 이미지 준비 중" : "자동 전송 비활성",
  );
  const [routingStatus, setRoutingStatus] = useState<RoutingStatus>({
    enabled: false,
  });
  const [companionRoute, setCompanionRoute] = useState<
    LiveDashboardState["route"]
  >({ status: "disabled" });
  const [companionLive, setCompanionLive] = useState<LiveDashboardState>(() => {
    const initial = createInitialLiveDashboardState();
    const initialLocale = resolvePhoneLocale(
      DEFAULT_PHONE_PREFERENCES.locale,
      typeof navigator === "undefined" ? "en" : navigator.language,
    );
    return {
      ...initial,
      todos: {
        ...initial.todos,
        value: localizeBuiltInTodos(
          initial.todos.value ?? [],
          initialLocale,
        ),
      },
    };
  });
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
  >(defaultRssSources("ko"));
  const phoneNavigationAvailable = routingStatus.enabled
    || companionOrsKey !== undefined;

  const setPhonePreferences = (value: PhonePreferences) => {
    const browserLanguage = typeof navigator === "undefined"
      ? "en"
      : navigator.language;
    const previousLocale = resolvePhoneLocale(
      phonePreferencesRef.current.locale,
      browserLanguage,
    );
    const nextLocale = resolvePhoneLocale(value.locale, browserLanguage);
    phonePreferencesRef.current = value;
    setPhonePreferencesState(value);
    if (nextLocale !== previousLocale) {
      setCompanionLive((current) => {
        if (!current.todos.value) return current;
        return {
          ...current,
          todos: {
            ...current.todos,
            value: localizeBuiltInTodos(current.todos.value, nextLocale),
          },
        };
      });
      liveSessionRef.current?.refreshLocale?.();
      displayRefreshRef.current?.();
    }
  };
  const setCompanionOrsKey = (value: string | undefined) => {
    companionOrsKeyRef.current = value;
    setCompanionOrsKeyState(value);
    liveSessionRef.current?.setRoutingKey?.(value);
  };
  const phoneLocale = resolvePhoneLocale(
    phonePreferences.locale,
    typeof navigator === "undefined" ? "en" : navigator.language,
  );

  useEffect(() => {
    if (!fastCanvasHudMode) return;
    let active = true;
    void resolvePhonePreferences(
      companionStorage,
      phoneNavigationAvailable,
    ).then((value) => {
      if (active) setPhonePreferences(value);
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode, phoneNavigationAvailable]);

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
    void resolveRssSources(companionStorage, phoneLocale).then((value) => {
      if (!active) return;
      setCompanionRssSources(value);
      void liveSessionRef.current?.refreshNewsSources?.();
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode, phoneLocale]);

  useHudController({
    autoStart,
    canvasRef,
    liveSessionRef,
    phonePreferencesRef,
    displayRefreshRef,
    companionOrsKeyRef,
    modes,
    setStatus,
    setRoutingStatus,
    setCompanionRoute,
    setCompanionLive,
    setCompanionBattery,
    setCompanionStorage,
  });

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
    enabled: phoneNavigationAvailable,
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
      aria-label={translatePhone(phoneLocale, "hudRasterPreview")}
    >
      <canvas
        ref={canvasRef}
        width="576"
        height="288"
        role="img"
        aria-label={translatePhone(phoneLocale, "hudGlassesFrame")}
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
            locale={phoneLocale}
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
                      : canvasHudMode
                        ? "576×288 · CANVAS HUD · SCROLL · 4 PAGES"
                        : "576×288 · 4 IMAGE TILES"}
            {" · STATIC MOCK"}
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
                  : canvasHudMode
                    ? "기본 뉴스 화면에서 아래 스크롤은 다음, 위 스크롤은 이전 페이지를 네 타일로 전송합니다."
                    : "이 Canvas가 네 장의 PNG로 나뉘어 안경에 순차 전송됩니다."}
      </p>
    </main>
  );
}
