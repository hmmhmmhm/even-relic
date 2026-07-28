import { wrapHudTextByWidth } from "./fast-detail-text";

export const FAST_NEWS_SUMMARY_FONT =
  'bold 21px "SFMono-Regular", Consolas, monospace';

export function paginateFastNewsSummary(
  context: CanvasRenderingContext2D,
  summary: string | undefined,
): readonly (readonly string[])[] {
  context.font = FAST_NEWS_SUMMARY_FONT;
  const lines = wrapHudTextByWidth(
    summary ?? "요약 없음",
    (value) => context.measureText(value).width,
    528,
    Number.MAX_SAFE_INTEGER,
  );
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 4) {
    pages.push([...lines.slice(index, index + 4)]);
  }
  return pages.length > 0 ? pages : [["요약 없음"]];
}
