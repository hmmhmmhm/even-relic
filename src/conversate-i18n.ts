import type { PhoneLocale } from "./phone-types";

const EN = {
  conversate: "Conversate", ready: "Ready", live: "Listening", keyRequired: "OpenAI key required",
  transcription: "Transcription", translation: "Translation", inform: "Inform",
  prepNote: "Prep Note", prepNoteHelp: "Context used before Inform is generated.",
  copilot: "Copilot", goal: "Conversation goal", goalHelp: "Leave blank to infer from context.",
  hideAfter: "Inform auto-hide", seconds: "seconds", history: "Conversation history",
  noHistory: "No conversations yet", clearHistory: "Clear conversation history",
  original: "Original", pronunciation: "Pronunciation", meaning: "Meaning",
  listening: "Listening…", informHistory: "Previous Inform", noInform: "No Inform yet",
  disabled: "Disabled", enabled: "Enabled",
} as const;

const KO: Record<keyof typeof EN, string> = {
  conversate: "Conversate", ready: "준비됨", live: "듣는 중", keyRequired: "OpenAI 키가 필요합니다",
  transcription: "전사", translation: "번역", inform: "Inform",
  prepNote: "Prep Note", prepNoteHelp: "Inform 생성 전에 참고할 사전 지식입니다.",
  copilot: "Copilot", goal: "대화 목표", goalHelp: "비워두면 최근 대화에서 목표를 추론합니다.",
  hideAfter: "Inform 자동 숨김", seconds: "초", history: "대화 기록",
  noHistory: "아직 대화 기록이 없습니다", clearHistory: "대화 기록 지우기",
  original: "원문", pronunciation: "발음", meaning: "뜻",
  listening: "듣는 중…", informHistory: "이전 Inform", noInform: "이전 Inform이 없습니다",
  disabled: "끔", enabled: "켬",
};

export type ConversateStringKey = keyof typeof EN;

export function isConversateStringKey(value: string): value is ConversateStringKey {
  return value in EN;
}

export function translateConversate(locale: PhoneLocale, key: ConversateStringKey): string {
  return (locale === "ko" ? KO : EN)[key];
}
