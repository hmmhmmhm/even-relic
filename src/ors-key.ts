import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";

export const ORS_KEY_HEADER = "x-sandevistan-ors-key";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

type KeyValidation =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly code: "empty" | "length" | "characters" };

function isStoredKey(value: unknown): value is string {
  return typeof value === "string" && validateOrsKey(value).ok;
}

export function validateOrsKey(value: string): KeyValidation {
  const normalized = value.trim();
  if (!normalized) return { ok: false, code: "empty" };
  if (normalized.length < 16 || normalized.length > 4_096) {
    return { ok: false, code: "length" };
  }
  if (CONTROL_CHARACTERS.test(normalized)) {
    return { ok: false, code: "characters" };
  }
  return { ok: true, value: normalized };
}

export function maskOrsKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) return "••••••••";
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

export function orsHeaders(value: string): Record<typeof ORS_KEY_HEADER, string> {
  return { [ORS_KEY_HEADER]: value };
}

export function resolveOrsKey(storage: EvenStorage): Promise<string | undefined> {
  return readCache(storage, "ors-key", isStoredKey);
}

export async function writeOrsKey(
  storage: EvenStorage,
  value: string,
): Promise<boolean> {
  const validation = validateOrsKey(value);
  if (!validation.ok) return false;
  return writeCache(storage, "ors-key", validation.value);
}

export function clearOrsKey(storage: EvenStorage): Promise<boolean> {
  return clearCache(storage, "ors-key");
}
