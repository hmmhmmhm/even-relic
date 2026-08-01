import {
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from "@evenrealities/even_hub_sdk";
import type { AiHudSnapshot } from "./ai-hud-state";
import {
  localizeAiTranscriptLines,
  translateAiApproval,
  translateAiHud,
} from "./ai-hud-i18n";
import {
  AI_TRANSCRIPT_VISIBLE_LINES,
  selectAiTranscriptDisplayRows,
} from "./ai-transcript";
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

export function createNativeAiTextContent(
  snapshot: AiHudSnapshot,
  selectedLine: number,
  locale: PhoneLocale,
): string {
  if (snapshot.pendingApproval) {
    const approval = translateAiApproval(locale);
    return [
      approval.title,
      `${snapshot.pendingApproval.serverName} // ${snapshot.pendingApproval.toolName}`,
      snapshot.pendingApproval.argumentsSummary,
      "",
      approval.approve,
      approval.reject,
    ].join("\n").slice(0, MAXIMUM_CONTENT_LENGTH);
  }
  const lines = snapshot.transcriptLines;
  const latestSelected = lines.length === 0
    || Math.floor(selectedLine) >= lines.length - 1;
  const showListening = snapshot.phase === "listening" && latestSelected;
  const listeningRows = showListening ? (lines.length > 0 ? 2 : 1) : 0;
  const visible = selectAiTranscriptDisplayRows(
    lines,
    selectedLine,
    AI_TRANSCRIPT_VISIBLE_LINES - listeningRows,
  );
  const localized = [...localizeAiTranscriptLines(visible, locale)];
  if (showListening) {
    if (localized.length > 0) localized.push("");
    localized.push(translateAiHud(locale, "listening"));
  }
  if (snapshot.error?.trim()) localized.push(snapshot.error.trim());
  if (localized.length === 0) {
    localized.push(snapshot.configured
      ? translateAiHud(locale, "listening")
      : translatePhone(locale, "aiKeyRequired"));
  }
  return localized.join("\n").slice(0, MAXIMUM_CONTENT_LENGTH);
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
