import type { ConversateSnapshot } from "./conversate-state";
import { translateConversate } from "./conversate-i18n";
import { drawFastCanvasText as drawText, FAST_CANVAS_COLOR as COLOR } from "./fast-canvas-style";
import { wrapHudText } from "./fast-detail-text";
import type { PhoneLocale } from "./phone-types";

export function drawFastConversatePanel(
  context: CanvasRenderingContext2D,
  snapshot: ConversateSnapshot,
  locale: PhoneLocale,
) {
  drawText(context, "CONVERSATE // LIVE", 308, 82, 11, COLOR.secondary, "bold");
  const latest = snapshot.history[0];
  const lines = latest?.segments.slice(-3).map((segment) => segment.translation || segment.text) ?? [];
  if (!lines.length) {
    drawText(context, translateConversate(locale, "ready"), 308, 112, 20, COLOR.primary, "bold");
    drawText(context, "TAP // START LISTENING", 308, 148, 11, COLOR.secondary, "bold");
  } else {
    lines.forEach((line, index) => drawText(
      context,
      wrapHudText(line, 29, 1)[0] ?? "",
      308,
      106 + index * 34,
      index === lines.length - 1 ? 17 : 14,
      index === lines.length - 1 ? COLOR.primary : COLOR.secondary,
      "bold",
    ));
  }
  drawText(context, `${snapshot.history.length} SAVED CONVERSATIONS`, 308, 246, 12, COLOR.secondary, "bold");
}

export function drawFastConversateDetail(
  context: CanvasRenderingContext2D,
  snapshot: ConversateSnapshot,
  locale: PhoneLocale,
) {
  if (snapshot.activeInform) {
    context.strokeStyle = COLOR.primary;
    context.strokeRect(8, 8, 560, 62);
    wrapHudText(snapshot.activeInform.text, 55, 2).forEach((line, index) => {
      drawText(context, line, 18, 17 + index * 22, 17, COLOR.primary, "bold");
    });
  }
  const latest = snapshot.segments.at(-1);
  const lines = latest
    ? [latest.text, ...(latest.translation ? [`→ ${latest.translation}`] : [])]
    : [translateConversate(locale, "listening")];
  lines.forEach((line, index) => drawText(
    context, wrapHudText(line, 50, 1)[0] ?? "", 14, 94 + index * 30, 20,
    index ? COLOR.secondary : COLOR.primary, "bold",
  ));
  const suggestion = snapshot.suggestions[snapshot.selectedSuggestion];
  if (suggestion) {
    drawText(context, `${snapshot.selectedSuggestion + 1}/3 ${suggestion.style}`, 14, 174, 11, COLOR.secondary, "bold");
    drawText(context, wrapHudText(suggestion.original, 45, 1)[0] ?? "", 14, 194, 18, COLOR.primary, "bold");
    drawText(context, wrapHudText(suggestion.pronunciation, 56, 1)[0] ?? "", 14, 224, 14, COLOR.secondary, "bold");
    drawText(context, wrapHudText(suggestion.meaning, 56, 1)[0] ?? "", 14, 250, 14, COLOR.primary, "bold");
  }
}
