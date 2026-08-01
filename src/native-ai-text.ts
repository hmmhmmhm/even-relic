import {
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from "@evenrealities/even_hub_sdk";
import type { AiHudSnapshot } from "./ai-hud-state";
import {
  localizeAiTranscriptPage,
  translateAiHud,
} from "./ai-hud-i18n";
import { translatePhone } from "./phone-i18n";
import type { PhoneLocale } from "./phone-types";

export const NATIVE_AI_TEXT_ID = 1;
export const NATIVE_AI_TEXT_NAME = "aiTranscript";
const MAXIMUM_CONTENT_LENGTH = 768;

type NativeAiTextBridge = {
  rebuildPageContainer(page: RebuildPageContainer): Promise<boolean>;
  textContainerUpgrade(update: TextContainerUpgrade): Promise<boolean>;
};

export type NativeAiTextModeController = {
  active(): boolean;
  enter(content: string): Promise<boolean>;
  update(content: string): Promise<boolean>;
  leave(): Promise<boolean>;
  dispose(): void;
};

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

export function createNativeAiTextContent(
  snapshot: AiHudSnapshot,
  selectedPage: number,
  locale: PhoneLocale,
): string {
  const pages = snapshot.transcriptPages;
  const index = Math.min(
    Math.max(0, Math.floor(selectedPage)),
    Math.max(0, pages.length - 1),
  );
  const position = pages.length > 0
    ? `${translateAiHud(locale, index === pages.length - 1 ? "live" : "history")} ${index + 1}/${pages.length}`
    : translateAiHud(locale, "live");
  const header = `${translatePhone(locale, "ai")} // ${phaseLabel(snapshot, locale)}  ·  ${position}`;
  const page = pages[index]?.trim();
  const transcript = page ? localizeAiTranscriptPage(page, locale) : "";
  const listening = snapshot.phase === "listening"
    ? translateAiHud(locale, "listeningPrompt")
    : "";
  const body = snapshot.error?.trim()
    || [listening, transcript].filter(Boolean).join("\n\n")
    || (snapshot.configured
      ? translateAiHud(locale, "listeningPrompt")
      : translatePhone(locale, "aiKeyRequired"));
  const footer = [
    translateAiHud(locale, "scrollTranscript"),
    translateAiHud(locale, "doubleTapBack"),
  ].join("\n");
  const fixedLength = header.length + footer.length + 4;
  const boundedBody = body.slice(
    0,
    Math.max(0, MAXIMUM_CONTENT_LENGTH - fixedLength),
  );
  return `${header}\n\n${boundedBody}\n\n${footer}`;
}

export function createNativeAiTextPage(content: string) {
  return new RebuildPageContainer({
    containerTotalNum: 1,
    textObject: [new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 8,
      containerID: NATIVE_AI_TEXT_ID,
      containerName: NATIVE_AI_TEXT_NAME,
      content,
      isEventCapture: 1,
    })],
  });
}

export function createNativeAiTextModeController(options: {
  readonly bridge: NativeAiTextBridge;
  readonly createImagePage: () => RebuildPageContainer;
  readonly onFailure?: (operation: string) => void;
}): NativeAiTextModeController {
  let isActive = false;
  let busy = false;
  let disposed = false;
  let lastContent: string | undefined;

  const attempt = async (
    operation: string,
    action: () => Promise<boolean>,
  ): Promise<boolean> => {
    if (disposed || busy) return false;
    busy = true;
    try {
      const succeeded = await action();
      if (!succeeded) options.onFailure?.(operation);
      return succeeded;
    } catch {
      options.onFailure?.(operation);
      return false;
    } finally {
      busy = false;
    }
  };

  return {
    active: () => isActive,
    async enter(content) {
      if (isActive) return this.update(content);
      const entered = await attempt("enter", () => (
        options.bridge.rebuildPageContainer(createNativeAiTextPage(content))
      ));
      if (entered) {
        isActive = true;
        lastContent = content;
      }
      return entered;
    },
    async update(content) {
      if (!isActive || content === lastContent) return false;
      const updated = await attempt("update", () => (
        options.bridge.textContainerUpgrade(new TextContainerUpgrade({
          containerID: NATIVE_AI_TEXT_ID,
          containerName: NATIVE_AI_TEXT_NAME,
          content,
        }))
      ));
      if (updated) lastContent = content;
      return updated;
    },
    async leave() {
      if (!isActive) return false;
      const left = await attempt("leave", () => (
        options.bridge.rebuildPageContainer(options.createImagePage())
      ));
      if (left) {
        isActive = false;
        lastContent = undefined;
      }
      return left;
    },
    dispose() {
      disposed = true;
      isActive = false;
      lastContent = undefined;
    },
  };
}
