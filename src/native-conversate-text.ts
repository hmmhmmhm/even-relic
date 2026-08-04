import {
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from "@evenrealities/even_hub_sdk";
import type { ConversateSettings, ConversateSnapshot } from "./conversate-state";
import { translateConversate } from "./conversate-i18n";
import type { PhoneLocale } from "./phone-types";

export type NativeConversateContent = { readonly inform: string; readonly body: string };

export function createNativeConversateContent(
  snapshot: ConversateSnapshot,
  locale: PhoneLocale,
  settings: ConversateSettings,
): NativeConversateContent {
  const inform = snapshot.activeInform?.text
    ?? (snapshot.informHistoryOpen
      ? `${translateConversate(locale, "informHistory")} ${snapshot.selectedInform + 1}/${snapshot.informs.length}`
      : "");
  if (snapshot.informHistoryOpen) {
    return {
      inform,
      body: snapshot.informs.length
        ? snapshot.informs.map((item, index) => `${index === snapshot.selectedInform ? ">" : " "} ${item.text}`).join("\n")
        : translateConversate(locale, "noInform"),
    };
  }
  const recent = snapshot.segments.slice(-4).flatMap((segment) => [
    ...(settings.transcription ? [segment.text] : []),
    ...(settings.translation && segment.translation ? [`→ ${segment.translation}`] : []),
  ]);
  if (settings.transcription && snapshot.partial) recent.push(snapshot.partial);
  const suggestion = snapshot.suggestions[snapshot.selectedSuggestion];
  if (suggestion) recent.push(
    "",
    `${snapshot.selectedSuggestion + 1}/3 · ${suggestion.style}`,
    suggestion.original,
    `${translateConversate(locale, "pronunciation")}: ${suggestion.pronunciation}`,
    `${translateConversate(locale, "meaning")}: ${suggestion.meaning}`,
  );
  if (snapshot.phase === "listening") recent.push("", translateConversate(locale, "listening"));
  if (snapshot.error) recent.push("", snapshot.error);
  return { inform, body: recent.join("\n").slice(-1_200) };
}

type Bridge = {
  rebuildPageContainer(page: RebuildPageContainer): Promise<boolean>;
  textContainerUpgrade(update: TextContainerUpgrade): Promise<boolean>;
};

const TEXT_ID = 1;
const TEXT_NAME = "conversateText";
const visibleText = (content: NativeConversateContent) =>
  [content.inform, content.body].filter(Boolean).join("\n\n") || " ";

function page(content: NativeConversateContent) {
  return new RebuildPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: 576, height: 288,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 8,
        containerID: TEXT_ID, containerName: TEXT_NAME,
        content: visibleText(content), isEventCapture: 1,
      }),
    ],
  });
}

export function createNativeConversateMode(options: {
  readonly bridge: Bridge;
  readonly createImagePage: () => RebuildPageContainer;
}) {
  let active = false;
  let busy = false;
  let last: NativeConversateContent | undefined;
  const update = async (content: NativeConversateContent) => {
    if (!active || busy) return false;
    busy = true;
    try {
      const succeeded = visibleText(content) === (last && visibleText(last)) || await options.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: TEXT_ID, containerName: TEXT_NAME, content: visibleText(content),
        }),
      );
      if (succeeded) last = content;
      return succeeded;
    } finally { busy = false; }
  };
  return {
    active: () => active,
    async enter(content: NativeConversateContent) {
      if (active) return update(content);
      if (busy) return false;
      busy = true;
      try {
        const entered = await options.bridge.rebuildPageContainer(page(content));
        if (entered) { active = true; last = content; }
        return entered;
      } finally { busy = false; }
    },
    update,
    async leave() {
      if (!active || busy) return false;
      busy = true;
      try {
        const left = await options.bridge.rebuildPageContainer(options.createImagePage());
        if (left) { active = false; last = undefined; }
        return left;
      } finally { busy = false; }
    },
    dispose() { active = false; last = undefined; },
  };
}
