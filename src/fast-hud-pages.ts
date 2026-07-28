import type { HudPage } from "./canvas-hud";
import type { DataStatus } from "./live-state";

export type FastHudPage = HudPage | "weather";
export type FastHudPageDirection = "next" | "previous";

const KEYLESS_FAST_HUD_PAGES = [
  "overview",
  "news",
  "todo",
  "weather",
] as const satisfies readonly FastHudPage[];

const ROUTED_FAST_HUD_PAGES = [
  ...KEYLESS_FAST_HUD_PAGES,
  "navigation",
] as const satisfies readonly FastHudPage[];

export function getFastHudPages(
  routeStatus: DataStatus,
): readonly FastHudPage[] {
  return routeStatus === "disabled"
    ? KEYLESS_FAST_HUD_PAGES
    : ROUTED_FAST_HUD_PAGES;
}

export function normalizeFastHudPage(
  page: FastHudPage,
  routeStatus: DataStatus,
): FastHudPage {
  const pages = getFastHudPages(routeStatus);
  return pages.includes(page) ? page : "weather";
}

export function getAdjacentFastHudPage(
  page: FastHudPage,
  direction: FastHudPageDirection,
  routeStatus: DataStatus,
): FastHudPage {
  const pages = getFastHudPages(routeStatus);
  const current = normalizeFastHudPage(page, routeStatus);
  const index = pages.indexOf(current);
  const offset = direction === "next" ? 1 : -1;
  return pages[(index + offset + pages.length) % pages.length];
}
