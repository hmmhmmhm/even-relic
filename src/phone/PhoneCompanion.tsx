import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FastCanvasBattery } from "../glasses";
import type { EvenStorage } from "../live-cache";
import type { LiveDashboardState, TodoItem } from "../live-state";
import {
  resolvePhoneLocale,
  translatePhone,
  type PhoneStringKey,
} from "../phone-i18n";
import type {
  PhoneLocale,
  PhonePreferences,
  PhoneScreen,
} from "../phone-types";
import type { RoutingStatus } from "../routing";
import { writePhonePreferences } from "../phone-preferences";
import type { RssSource } from "../rss-sources";
import { weatherCodeLabel } from "../weather";
import { DevicesScreen } from "./DevicesScreen";
import { DeveloperScreen } from "./DeveloperScreen";
import { HudLayoutScreen } from "./HudLayoutScreen";
import { LanguageScreen } from "./LanguageScreen";
import { NavigationScreen } from "./NavigationScreen";
import { NewsScreen } from "./NewsScreen";
import { PhoneHeader } from "./PhoneHeader";
import { PhoneHome } from "./PhoneHome";
import { TodoScreen } from "./TodoScreen";
import { WeatherScreen } from "./WeatherScreen";
import "./phone-shell.css";
import "./phone-home.css";
import "./phone-detail.css";

type PhoneCompanionProps = {
  readonly canvas: ReactNode;
  readonly status: string;
  readonly battery?: FastCanvasBattery;
  readonly live: LiveDashboardState;
  readonly routingStatus: RoutingStatus;
  readonly preferences: PhonePreferences;
  readonly storage?: EvenStorage;
  readonly onPreferencesChange: (value: PhonePreferences) => void;
  readonly onTodosChange: (items: readonly TodoItem[]) => void;
  readonly onWeatherRefresh: () => Promise<"accepted" | "dropped">;
  readonly routeControls: ReactNode;
  readonly rssSources?: readonly RssSource[];
  readonly onRssSourcesChange?: (sources: readonly RssSource[]) => void;
  readonly onOrsKeyChange?: (key: string | undefined) => void;
  readonly onDeleteRoute?: () => void | Promise<void>;
};

const SCREEN_TITLE: Record<Exclude<PhoneScreen, "home">, PhoneStringKey> = {
  devices: "devices",
  "hud-layout": "hudLayout",
  news: "news",
  todo: "todo",
  weather: "weather",
  navigation: "navigation",
  language: "language",
  developer: "developer",
};

function transportStatusLabel(
  status: string,
  t: (key: PhoneStringKey) => string,
): string {
  if (/fail|error|실패|오류/i.test(status)) return t("unavailable");
  if (/disabled|비활성/i.test(status)) return t("disabled");
  if (/wait|대기|준비/i.test(status)) return t("ready");
  return t("active");
}

export function PhoneCompanion({
  canvas,
  status,
  battery,
  live,
  routingStatus,
  preferences,
  storage,
  onPreferencesChange,
  onTodosChange,
  onWeatherRefresh,
  routeControls,
  rssSources = [],
  onRssSourcesChange,
  onOrsKeyChange,
  onDeleteRoute,
}: PhoneCompanionProps) {
  const [screen, setScreen] = useState<PhoneScreen>("home");
  const locale = resolvePhoneLocale(
    preferences.locale,
    typeof navigator === "undefined" ? "en" : navigator.language,
  );
  const t = (key: PhoneStringKey) => translatePhone(locale, key);
  const localizedStatus = transportStatusLabel(status, t);

  const cards = useMemo(() => {
    const weather = live.weather.value;
    const enabledSources = rssSources.filter((source) => source.enabled).length;
    return [
      {
        screen: "devices",
        icon: "devices",
        titleKey: "devices",
        status: battery?.level === undefined
          ? t("unavailable")
          : `${battery.label} ${battery.level}%`,
      },
      {
        screen: "hud-layout",
        icon: "layout",
        titleKey: "hudLayout",
        status: `${preferences.enabled.length} ${t("active")}`,
      },
      {
        screen: "news",
        icon: "article",
        titleKey: "news",
        status: `${live.news.value?.length ?? 0} ${t("items")}`
          + ` · ${enabledSources} ${t("sources")}`,
      },
      {
        screen: "todo",
        icon: "checklist",
        titleKey: "todo",
        status: `${live.todos.value?.filter((item) => !item.completed).length ?? 0} ${t("items")}`,
      },
      {
        screen: "weather",
        icon: "weather",
        titleKey: "weather",
        status: weather
          ? `${Math.round(weather.temperature)}° · ${
              weatherCodeLabel(weather.weatherCode, locale)
            }`
          : t("noData"),
      },
      {
        screen: "navigation",
        icon: "navigation",
        titleKey: "navigation",
        status: routingStatus.enabled ? t("configured") : t("notConfigured"),
      },
      {
        screen: "language",
        icon: "language",
        titleKey: "language",
        status: preferences.locale === "system"
          ? t("system")
          : preferences.locale === "ko"
            ? t("korean")
            : t("english"),
      },
      {
        screen: "developer",
        icon: "debug",
        titleKey: "developer",
        status: localizedStatus,
      },
    ] as const;
  }, [
    battery,
    live,
    preferences,
    routingStatus.enabled,
    rssSources,
    localizedStatus,
    locale,
  ]);

  const savePreferences = async (next: PhonePreferences): Promise<boolean> => {
    if (!storage) return false;
    const saved = await writePhonePreferences(storage, next);
    if (saved) onPreferencesChange(next);
    return saved;
  };

  const content = () => {
    switch (screen) {
      case "devices":
        return (
          <DevicesScreen
            battery={battery}
            status={localizedStatus}
            t={t}
          />
        );
      case "hud-layout":
        return (
          <HudLayoutScreen
            preferences={preferences}
            navigationAvailable={routingStatus.enabled}
            t={t}
            onChange={savePreferences}
          />
        );
      case "news":
        return (
          <NewsScreen
            storage={storage}
            t={t}
            onSourcesChange={onRssSourcesChange}
          />
        );
      case "todo":
        return (
          <TodoScreen
            items={live.todos.value ?? []}
            storage={storage}
            t={t}
            onChange={onTodosChange}
          />
        );
      case "weather":
        return (
          <WeatherScreen
            live={live}
            locale={locale as PhoneLocale}
            t={t}
            onRefresh={onWeatherRefresh}
          />
        );
      case "navigation":
        return (
          <NavigationScreen
            storage={storage}
            routeControls={routeControls}
            t={t}
            serverConfigured={routingStatus.enabled}
            onDeleteRoute={onDeleteRoute}
            onKeyChange={onOrsKeyChange}
          />
        );
      case "language":
        return (
          <LanguageScreen
            value={preferences.locale}
            t={t}
            onChange={(value) => savePreferences({
              ...preferences,
              locale: value,
            })}
          />
        );
      case "developer":
        return (
          <DeveloperScreen
            status={localizedStatus}
            routingEnabled={routingStatus.enabled}
            rssSources={rssSources}
            t={t}
          />
        );
      case "home":
        return null;
    }
  };

  return (
    <main className="phone-companion">
      <div hidden={screen !== "home"}>
        <PhoneHome
          t={t}
          cards={cards}
          preview={canvas}
          onOpen={setScreen}
        />
      </div>
      {screen !== "home" && (
        <section className="phone-detail-screen">
          <PhoneHeader
            title={t(SCREEN_TITLE[screen])}
            parentLabel={t("dashboard")}
            onBack={() => setScreen("home")}
          />
          <div className="phone-detail-content">{content()}</div>
        </section>
      )}
    </main>
  );
}
