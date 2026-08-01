import type { AiHudSnapshot } from "./ai-hud-state";
import {
  drawFastCanvasOpenFrame as drawFrame,
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";
import { wrapHudText } from "./fast-detail-text";
import {
  drawDetailFooter as drawFooter,
  drawDetailHeader as drawHeader,
} from "./fast-detail-frame";
import { translatePhone } from "./phone-i18n";
import type { PhoneLocale } from "./phone-types";

function usd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.0000";
  return `$${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}`;
}

function phaseLabel(snapshot: AiHudSnapshot): string {
  if (!snapshot.configured) return "KEY REQUIRED";
  switch (snapshot.phase) {
    case "connecting": return "CONNECTING";
    case "listening": return "LISTENING";
    case "thinking": return "THINKING";
    case "paused": return "PAUSED";
    case "error": return "ERROR";
    default: return "READY";
  }
}

export function drawFastAiPanel(
  context: CanvasRenderingContext2D,
  snapshot: AiHudSnapshot,
  locale: PhoneLocale,
) {
  drawText(
    context,
    `ASK AI // ${phaseLabel(snapshot)}`,
    308,
    82,
    11,
    COLOR.secondary,
    "bold",
  );
  const latest = snapshot.history[0];
  if (!snapshot.configured) {
    drawText(
      context,
      translatePhone(locale, "aiKeyRequired"),
      308,
      110,
      18,
      COLOR.primary,
      "bold",
    );
    drawText(context, "SET KEY ON PHONE", 308, 142, 12, COLOR.dim, "bold");
  } else if (latest) {
    drawText(context, "RECENT // YOU", 308, 104, 10, COLOR.secondary, "bold");
    drawText(
      context,
      wrapHudText(latest.user || "—", 28, 1)[0] ?? "—",
      308,
      122,
      15,
      COLOR.primary,
      "bold",
    );
    drawText(context, "RECENT // AI", 308, 154, 10, COLOR.secondary, "bold");
    drawText(
      context,
      wrapHudText(latest.assistant || "—", 28, 1)[0] ?? "—",
      308,
      172,
      15,
      COLOR.primary,
      "bold",
    );
  } else {
    drawText(context, "TAP TO START", 308, 112, 22, COLOR.primary, "bold");
    drawText(context, "G2 MIC · TEXT RESPONSE", 308, 150, 11, COLOR.dim, "bold");
  }
  drawText(
    context,
    `${translatePhone(locale, "thisWeek").toUpperCase()} ${usd(snapshot.weekUsd)}`,
    308,
    232,
    13,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    `${translatePhone(locale, "thisMonth").toUpperCase()} ${usd(snapshot.monthUsd)}`,
    308,
    252,
    13,
    COLOR.primary,
    "bold",
  );
}

export function drawFastAiDetail(
  context: CanvasRenderingContext2D,
  snapshot: AiHudSnapshot,
  selectedPage: number,
  locale: PhoneLocale,
) {
  const pages = snapshot.transcriptPages;
  const index = Math.min(Math.max(0, selectedPage), Math.max(0, pages.length - 1));
  drawHeader(
    context,
    `ASK AI // ${phaseLabel(snapshot)}`,
    pages.length > 0 ? `${index + 1}/${pages.length}` : undefined,
  );
  drawFrame(context, 14, 44, 548, 204);
  const content = snapshot.error
    ?? pages[index]
    ?? (snapshot.configured
      ? "Listening through the G2 microphone. Speak naturally."
      : translatePhone(locale, "aiKeyRequired"));
  wrapHudText(content, 46, 6).forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      32,
      62 + lineIndex * 29,
      lineIndex === 0 ? 23 : 21,
      snapshot.phase === "error" ? COLOR.secondary : COLOR.primary,
      "bold",
    );
  });
  drawFooter(
    context,
    "SCROLL // TRANSCRIPT",
    snapshot.phase === "paused" ? "TAP // RESUME" : "TAP // PAUSE",
  );
}
