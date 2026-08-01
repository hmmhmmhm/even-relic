import { jsonResponse } from "./http.js";

export const OPENAI_KEY_HEADER = "x-sandevistan-openai-key";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function validOpenAiKey(value) {
  return typeof value === "string"
    && value.startsWith("sk-")
    && value.length >= 20
    && value.length <= 4_096
    && !CONTROL_CHARACTERS.test(value);
}

export function openAiError(code, message, status) {
  return jsonResponse(
    { error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}
