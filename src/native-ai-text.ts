import {
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from "@evenrealities/even_hub_sdk";
import type { AiHudSnapshot } from "./ai-hud-state";
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
    ? `${index === pages.length - 1 ? "LIVE" : "HISTORY"} ${index + 1}/${pages.length}`
    : "LIVE";
  const header = `ASK AI // ${phaseLabel(snapshot)}  ·  ${position}`;
  const body = snapshot.error?.trim()
    || pages[index]?.trim()
    || (snapshot.configured
      ? "Listening through the G2 microphone. Speak naturally."
      : translatePhone(locale, "aiKeyRequired"));
  const action = snapshot.phase === "paused" ? "RESUME" : "PAUSE";
  const footer = [
    "SCROLL // TRANSCRIPT",
    `TAP // ${action}  ·  DOUBLE TAP // BACK`,
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
