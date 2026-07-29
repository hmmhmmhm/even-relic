import { wrapHudTextByWidth } from "./fast-detail-text";
import { translateHud } from "./hud-i18n";
import type { PhoneLocale } from "./phone-types";

export const FAST_NEWS_SUMMARY_FONT =
  'bold 21px "SFMono-Regular", Consolas, monospace';

export function paginateFastNewsSummary(
  context: CanvasRenderingContext2D,
  summary: string | undefined,
  locale: PhoneLocale = "ko",
): readonly (readonly string[])[] {
  context.font = FAST_NEWS_SUMMARY_FONT;
  const fallback = translateHud(locale, "noSummary");
  const lines = wrapHudTextByWidth(
    summary ?? fallback,
    (value) => context.measureText(value).width,
    528,
    Number.MAX_SAFE_INTEGER,
  );
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 4) {
    pages.push([...lines.slice(index, index + 4)]);
  }
  return pages.length > 0 ? pages : [[fallback]];
}
