import type { AiHudSnapshot } from "./ai-hud-state";
import {
  aiHudStatusLabel,
  localizeAiTranscriptLines,
  translateAiHud,
} from "./ai-hud-i18n";
import {
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";
import { wrapHudText } from "./fast-detail-text";
import {
  AI_TRANSCRIPT_VISIBLE_LINES,
  selectAiTranscriptDisplayRows,
} from "./ai-transcript";
import { translatePhone } from "./phone-i18n";
import type { PhoneLocale } from "./phone-types";

function usd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.0000";
  return `$${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}`;
}

export function drawFastAiPanel(
  context: CanvasRenderingContext2D,
  snapshot: AiHudSnapshot,
  locale: PhoneLocale,
) {
  drawText(
    context,
    `${translatePhone(locale, "ai")} // ${aiHudStatusLabel(snapshot, locale)}`,
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
  } else if (latest) {
    drawText(
      context,
      `${translateAiHud(locale, "history")} // ${translateAiHud(locale, "you")}`,
      308,
      104,
      10,
      COLOR.secondary,
      "bold",
    );
    drawText(
      context,
      wrapHudText(latest.user || "—", 28, 1)[0] ?? "—",
      308,
      122,
      15,
      COLOR.primary,
      "bold",
    );
    drawText(
      context,
      `${translateAiHud(locale, "history")} // ${translateAiHud(locale, "assistant")}`,
      308,
      154,
      10,
      COLOR.secondary,
      "bold",
    );
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
    drawText(
      context,
      translatePhone(locale, "noConversations"),
      308,
      112,
      18,
      COLOR.primary,
      "bold",
    );
    drawText(
      context,
      translateAiHud(locale, "ready"),
      308,
      150,
      11,
      COLOR.dim,
      "bold",
    );
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
  selectedLine: number,
  locale: PhoneLocale,
) {
  drawText(
    context,
    aiHudStatusLabel(snapshot, locale),
    8,
    14,
    14,
    COLOR.secondary,
    "bold",
  );
  const revealRows = snapshot.canRevealFullResponse ? 2 : 0;
  const lines = [...localizeAiTranscriptLines(
    selectAiTranscriptDisplayRows(
      snapshot.transcriptLines,
      selectedLine,
      Math.max(1, AI_TRANSCRIPT_VISIBLE_LINES - 2 - revealRows),
    ),
    locale,
  )];
  if (snapshot.error?.trim()) lines.push(snapshot.error.trim());
  if (lines.length === 0 && !snapshot.configured) {
    lines.push(snapshot.configured
      ? translateAiHud(locale, "listening")
      : translatePhone(locale, "aiKeyRequired"));
  }
  lines.forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      8,
      52 + lineIndex * 29,
      21,
      snapshot.phase === "error" ? COLOR.secondary : COLOR.primary,
      "bold",
    );
  });
  if (snapshot.canRevealFullResponse) {
    drawText(
      context,
      translateAiHud(locale, "tapReveal"),
      8,
      274,
      13,
      COLOR.secondary,
      "bold",
    );
  }
}
