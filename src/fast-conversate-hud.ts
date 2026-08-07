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
  const visibleInform = snapshot.informHistoryOpen
    ? snapshot.informs[snapshot.selectedInform]
    : snapshot.activeInform;
  if (visibleInform) {
    context.strokeStyle = COLOR.primary;
    context.strokeRect(8, 8, 560, 62);
    wrapHudText(visibleInform.text, 55, 2).forEach((line, index) => {
      drawText(context, line, 18, 17 + index * 22, 17, COLOR.primary, "bold");
    });
  }
  const index = Math.max(0, snapshot.segments.length - 1 - snapshot.transcriptOffset);
  const visible = snapshot.segments[index];
  const lines = visible
    ? [visible.text, ...(visible.translation ? [`→ ${visible.translation}`] : [])]
    : [];
  if (snapshot.partial && snapshot.transcriptOffset === 0) lines.push(snapshot.partial);
  if (!lines.length) lines.push(translateConversate(locale, "listening"));
  const transcriptY = visibleInform ? 84 : 18;
  lines.forEach((line, index) => drawText(
    context, wrapHudText(line, 50, 2)[0] ?? "", 14, transcriptY + index * 32, 20,
    index ? COLOR.secondary : COLOR.primary, "bold",
  ));
  const suggestion = snapshot.suggestions[snapshot.selectedSuggestion];
  if (suggestion) {
    drawText(context, `${snapshot.copilotOpen ? ">" : "·"} ${snapshot.selectedSuggestion + 1}/${snapshot.suggestions.length} ${suggestion.style}`, 14, 198, 11, COLOR.secondary, "bold");
    drawText(context, wrapHudText(suggestion.original, 52, 1)[0] ?? "", 14, 218, 16, COLOR.primary, "bold");
    drawText(context, `${wrapHudText(suggestion.pronunciation, 26, 1)[0] ?? ""} · ${wrapHudText(suggestion.meaning, 28, 1)[0] ?? ""}`, 14, 248, 13, COLOR.secondary, "bold");
  }
}
