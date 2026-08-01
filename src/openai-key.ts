import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";

export const OPENAI_KEY_HEADER = "x-sandevistan-openai-key";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export type OpenAiKeyValidation =
  | { readonly ok: true; readonly value: string }
  | {
      readonly ok: false;
      readonly code: "empty" | "length" | "format" | "characters";
    };

export function validateOpenAiKey(value: string): OpenAiKeyValidation {
  const normalized = value.trim();
  if (!normalized) return { ok: false, code: "empty" };
  if (!normalized.startsWith("sk-")) {
    return { ok: false, code: "format" };
  }
  if (normalized.length < 20 || normalized.length > 4_096) {
    return { ok: false, code: "length" };
  }
  if (CONTROL_CHARACTERS.test(normalized)) {
    return { ok: false, code: "characters" };
  }
  return { ok: true, value: normalized };
}

function isStoredOpenAiKey(value: unknown): value is string {
  return typeof value === "string" && validateOpenAiKey(value).ok;
}

export function maskOpenAiKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) return "••••••••";
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

export function openAiKeyHeaders(
  value: string,
): Record<typeof OPENAI_KEY_HEADER, string> {
  return { [OPENAI_KEY_HEADER]: value };
}

export function resolveOpenAiKey(
  storage: EvenStorage,
): Promise<string | undefined> {
  return readCache(storage, "openai-key", isStoredOpenAiKey);
}

export async function writeOpenAiKey(
  storage: EvenStorage,
  value: string,
): Promise<boolean> {
  const validation = validateOpenAiKey(value);
  if (!validation.ok) return false;
  return writeCache(storage, "openai-key", validation.value);
}

export function clearOpenAiKey(storage: EvenStorage): Promise<boolean> {
  return clearCache(storage, "openai-key");
}
