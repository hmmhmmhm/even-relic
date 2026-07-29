import type { DataStatus, LiveDashboardState } from "./live-state";
import type { FastCanvasBattery } from "./glasses";
import type { RoutingStatus } from "./routing";

export type HudPageId =
  | "overview"
  | "news"
  | "todo"
  | "weather"
  | "navigation";

export type PhoneLocale = "ko" | "en";
export type PhoneLocaleSetting = "system" | PhoneLocale;

export type PhoneScreen =
  | "home"
  | "devices"
  | "hud-layout"
  | "news"
  | "todo"
  | "weather"
  | "navigation"
  | "language"
  | "developer";

export type PhonePreferences = {
  readonly locale: PhoneLocaleSetting;
  readonly order: readonly HudPageId[];
  readonly enabled: readonly HudPageId[];
};

export type PhoneControllerSnapshot = {
  readonly status: string;
  readonly battery?: FastCanvasBattery;
  readonly live: LiveDashboardState;
  readonly routingStatus: RoutingStatus;
  readonly routeStatus: DataStatus;
};
