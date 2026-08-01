import type { AiHudSnapshot } from "./ai-hud-state";
import {
  localizeAiTranscriptPage,
  translateAiHud,
} from "./ai-hud-i18n";
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

function phaseLabel(snapshot: AiHudSnapshot, locale: PhoneLocale): string {
  if (!snapshot.configured) return translatePhone(locale, "aiKeyRequired");
  switch (snapshot.phase) {
    case "connecting": return translateAiHud(locale, "connecting");
    case "listening": return translateAiHud(locale, "listening");
    case "thinking": return translateAiHud(locale, "thinking");
    case "displaying": return translateAiHud(locale, "displaying");
    case "error": return translateAiHud(locale, "error");
    default: return translateAiHud(locale, "ready");
  }
}

export function drawFastAiPanel(
  context: CanvasRenderingContext2D,
  snapshot: AiHudSnapshot,
  locale: PhoneLocale,
) {
  drawText(
    context,
    `${translatePhone(locale, "ai")} // ${phaseLabel(snapshot, locale)}`,
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
  selectedPage: number,
  locale: PhoneLocale,
) {
  const pages = snapshot.transcriptPages;
  const index = Math.min(Math.max(0, selectedPage), Math.max(0, pages.length - 1));
  drawHeader(
    context,
    `${translatePhone(locale, "ai")} // ${phaseLabel(snapshot, locale)}`,
    pages.length > 0
      ? `${translateAiHud(locale, index === pages.length - 1 ? "live" : "history")} ${index + 1}/${pages.length}`
      : undefined,
  );
  drawFrame(context, 14, 44, 548, 204);
  const page = pages[index]
    ? localizeAiTranscriptPage(pages[index], locale)
    : undefined;
  const lines = snapshot.error
    ? wrapHudText(snapshot.error, 46, 6)
    : page
      ? page.split("\n").slice(0, 6)
      : wrapHudText(
          snapshot.configured
            ? translateAiHud(locale, "listeningPrompt")
            : translatePhone(locale, "aiKeyRequired"),
          46,
          6,
        );
  lines.forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      32,
      62 + lineIndex * 29,
      21,
      snapshot.phase === "error" ? COLOR.secondary : COLOR.primary,
      "bold",
    );
  });
  drawFooter(
    context,
    translateAiHud(locale, "scrollTranscript"),
    undefined,
    translateAiHud(locale, "doubleTapBack"),
  );
}
