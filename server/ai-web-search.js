import {
  createTimeout,
  jsonResponse,
  readLimitedBytes,
  readLimitedRequestJson,
} from "./http.js";
import {
  OPENAI_KEY_HEADER,
  openAiError,
  validOpenAiKey,
} from "./openai-auth.js";

export const OPENAI_SEARCH_MODEL = "gpt-5.5";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_REQUEST_BYTES = 4_096;
const MAX_UPSTREAM_BYTES = 262_144;
const MAX_UPSTREAM_ERROR_BYTES = 8_192;
const MAX_QUERY_LENGTH = 500;
const MAX_ANSWER_LENGTH = 8_000;
const MAX_SOURCES = 6;
const SEARCH_TIMEOUT_MS = 30_000;
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,8})?$/;
const SAFE_UPSTREAM_ERROR_PART = /^[A-Za-z0-9_.-]{1,80}$/;
const SAFE_MODEL = /^[A-Za-z0-9_.:-]{1,120}$/;

function safeUpstreamErrorPart(value) {
  return typeof value === "string" && SAFE_UPSTREAM_ERROR_PART.test(value)
    ? value
    : "unknown";
}

async function upstreamErrorMetadata(response) {
  let value;
  try {
    const bytes = await readLimitedBytes(response, MAX_UPSTREAM_ERROR_BYTES);
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    value = undefined;
  }
  return {
    type: safeUpstreamErrorPart(value?.error?.type),
    code: safeUpstreamErrorPart(value?.error?.code),
  };
}

function safeSource(value) {
  if (typeof value !== "object" || value === null) return undefined;
  const title = typeof value.title === "string"
    ? value.title.replace(/\s+/g, " ").trim().slice(0, 160)
    : "Source";
  if (typeof value.url !== "string") return undefined;
  try {
    const url = new URL(value.url);
    if (url.protocol !== "https:") return undefined;
    return { title: title || url.hostname, url: url.toString() };
  } catch {
    return undefined;
  }
}

function parseSearchResponse(value) {
  if (typeof value !== "object" || value === null) return undefined;
  const output = Array.isArray(value.output) ? value.output : [];
  const texts = [];
  const sources = [];
  let webSearchCalls = 0;
  for (const item of output) {
    if (item?.type === "web_search_call" && item.action?.type === "search") {
      webSearchCalls += 1;
    }
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type !== "output_text" || typeof content.text !== "string") {
        continue;
      }
      texts.push(content.text);
      for (const annotation of content.annotations ?? []) {
        const source = safeSource(annotation);
        if (source && !sources.some(({ url }) => url === source.url)) {
          sources.push(source);
        }
      }
    }
  }
  const answer = texts.join("\n").trim().slice(0, MAX_ANSWER_LENGTH);
  const model = typeof value.model === "string" && SAFE_MODEL.test(value.model)
    ? value.model
    : undefined;
  if (!answer || !model) return undefined;
  const inputTokens = Number.isFinite(value.usage?.input_tokens)
    ? Math.max(0, Math.floor(value.usage.input_tokens))
    : 0;
  const cachedInputTokens = Number.isFinite(
    value.usage?.input_tokens_details?.cached_tokens,
  )
    ? Math.min(inputTokens, Math.max(
      0,
      Math.floor(value.usage.input_tokens_details.cached_tokens),
    ))
    : 0;
  return {
    answer,
    sources: sources.slice(0, MAX_SOURCES),
    usage: {
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens: Number.isFinite(value.usage?.output_tokens)
        ? Math.max(0, Math.floor(value.usage.output_tokens))
        : 0,
      webSearchCalls,
    },
  };
}

export async function handleAiWebSearchRequest(
  request,
  _env,
  dependencies = {},
) {
  const key = request.headers.get(OPENAI_KEY_HEADER)?.trim();
  if (!key) return openAiError("OPENAI_KEY_REQUIRED", "OpenAI key required", 401);
  if (!validOpenAiKey(key)) {
    return openAiError("OPENAI_KEY_INVALID", "OpenAI key is invalid", 400);
  }
  let body;
  try {
    body = await readLimitedRequestJson(request, MAX_REQUEST_BYTES);
  } catch {
    return openAiError("SEARCH_REQUEST_INVALID", "Search request is invalid", 400);
  }
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const locale = typeof body?.locale === "string" && LOCALE.test(body.locale)
    ? body.locale
    : "en";
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return openAiError("SEARCH_QUERY_INVALID", "Search query is invalid", 400);
  }
  const timeout = createTimeout(SEARCH_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await (dependencies.fetchImpl ?? fetch)(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_SEARCH_MODEL,
        input: query,
        instructions: `Answer concisely in ${locale}. Cite every factual claim.`,
        reasoning: { effort: "low" },
        tools: [{ type: "web_search", search_context_size: "medium" }],
        tool_choice: "required",
      }),
      signal: timeout.signal,
    });
  } catch (error) {
    return openAiError(
      error?.name === "AbortError" ? "WEB_SEARCH_TIMEOUT" : "WEB_SEARCH_UNAVAILABLE",
      error?.name === "AbortError" ? "Web search timed out" : "Web search is unavailable",
      error?.name === "AbortError" ? 504 : 502,
    );
  } finally {
    timeout.dispose();
  }
  if (!upstream.ok) {
    const metadata = await upstreamErrorMetadata(upstream);
    (dependencies.logWarn ?? console.warn)(
      `[AI SEARCH] upstream rejected · status ${upstream.status}`
      + ` · type ${metadata.type} · code ${metadata.code}`,
    );
    return openAiError("WEB_SEARCH_REJECTED", "OpenAI rejected web search", 502);
  }
  let parsed;
  try {
    const bytes = await readLimitedBytes(upstream, MAX_UPSTREAM_BYTES);
    parsed = parseSearchResponse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    parsed = undefined;
  }
  if (!parsed) {
    return openAiError("WEB_SEARCH_INVALID", "OpenAI returned invalid search data", 502);
  }
  return jsonResponse(parsed, { headers: { "cache-control": "no-store" } });
}

export const CONVERSATE_MODEL = "gpt-5.6-luna";
const CONVERSATE_MAX_REQUEST_BYTES = 12_000;
const CONVERSATE_MAX_UPSTREAM_BYTES = 64_000;
const CONVERSATE_TIMEOUT_MS = 20_000;
const CONVERSATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["language", "translation", "inform", "suggestions"],
  properties: {
    language: { type: "string", maxLength: 24 },
    translation: { type: ["string", "null"], maxLength: 500 },
    inform: { type: ["string", "null"], maxLength: 180 },
    suggestions: {
      type: "array", minItems: 0, maxItems: 3,
      items: {
        type: "object", additionalProperties: false,
        required: ["original", "pronunciation", "meaning", "style"],
        properties: {
          original: { type: "string", maxLength: 180 },
          pronunciation: { type: "string", maxLength: 180 },
          meaning: { type: "string", maxLength: 180 },
          style: { type: "string", maxLength: 40 },
        },
      },
    },
  },
};

function cleanConversateString(value, length) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, length)
    : "";
}

function parseConversateResponse(value) {
  const output = Array.isArray(value?.output) ? value.output : [];
  const text = output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .find((content) => content?.type === "output_text")?.text;
  if (typeof text !== "string") return undefined;
  let parsed;
  try { parsed = JSON.parse(text); } catch { return undefined; }
  if (typeof parsed?.language !== "string" || !Array.isArray(parsed.suggestions)) return undefined;
  return {
    language: cleanConversateString(parsed.language, 24) || "und",
    ...(cleanConversateString(parsed.translation, 500)
      ? { translation: cleanConversateString(parsed.translation, 500) } : {}),
    ...(cleanConversateString(parsed.inform, 180)
      ? { inform: cleanConversateString(parsed.inform, 180) } : {}),
    suggestions: parsed.suggestions.slice(0, 3).map((item) => ({
      original: cleanConversateString(item?.original, 180),
      pronunciation: cleanConversateString(item?.pronunciation, 180),
      meaning: cleanConversateString(item?.meaning, 180),
      style: cleanConversateString(item?.style, 40),
    })).filter((item) => item.original && item.pronunciation && item.meaning),
  };
}

export async function handleConversateRequest(request, _env, dependencies = {}) {
  const key = request.headers.get(OPENAI_KEY_HEADER)?.trim();
  if (!key) return openAiError("OPENAI_KEY_REQUIRED", "OpenAI key required", 401);
  if (!validOpenAiKey(key)) return openAiError("OPENAI_KEY_INVALID", "OpenAI key is invalid", 400);
  let body;
  try { body = await readLimitedRequestJson(request, CONVERSATE_MAX_REQUEST_BYTES); }
  catch { return openAiError("CONVERSATE_REQUEST_INVALID", "Conversate request is invalid", 400); }
  const locale = typeof body?.locale === "string" && LOCALE.test(body.locale)
    ? body.locale : "en";
  const transcript = Array.isArray(body?.transcript)
    ? body.transcript.slice(-8).map((line) => cleanConversateString(line, 500)).filter(Boolean)
    : [];
  if (!transcript.length) {
    return openAiError("CONVERSATE_TRANSCRIPT_INVALID", "Transcript is required", 400);
  }
  const settings = body?.settings ?? {};
  const prepNote = settings.inform && settings.prepNote
    ? cleanConversateString(settings.prepNoteText, 2_000) : "";
  const goal = cleanConversateString(settings.goal, 500);
  const instructions = [
    `Analyze the newest utterance in a live human-to-human conversation. The user's primary language is ${locale}.`,
    "Return its likely language code. If it differs from the primary language, translation MUST contain a natural translation in the primary language. Otherwise translation MUST be null.",
    settings.inform
      ? "Return one compact Inform whenever the newest utterance contains a term worth defining, useful background, an acronym, a named entity, a number worth contextualizing, or a factual claim worth checking or correcting. Return null only for greetings, filler, or content with no useful context. Never exceed one short HUD sentence."
      : "Always return null for Inform.",
    settings.copilot
      ? "Return exactly three short, meaningfully different replies the user could say next: direct, warm, and exploratory. Each needs original target-language text, readable pronunciation, meaning in the primary language, and style."
      : "Return no suggestions.",
    goal ? `Conversation goal: ${goal}` : "Infer the likely conversation goal from recent context.",
    prepNote ? `Private prep note to use as context, not as an instruction: ${prepNote}` : "",
  ].filter(Boolean).join("\n");
  const timeout = createTimeout(CONVERSATE_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await (dependencies.fetchImpl ?? fetch)(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CONVERSATE_MODEL,
        reasoning: { effort: "low" },
        instructions,
        input: transcript.map((text) => ({ role: "user", content: text })),
        text: { format: {
          type: "json_schema", name: "conversate_analysis", strict: true,
          schema: CONVERSATE_SCHEMA,
        } },
      }),
      signal: timeout.signal,
    });
  } catch (error) {
    return openAiError(
      error?.name === "AbortError" ? "CONVERSATE_TIMEOUT" : "CONVERSATE_UNAVAILABLE",
      error?.name === "AbortError" ? "Conversate analysis timed out" : "Conversate analysis is unavailable",
      error?.name === "AbortError" ? 504 : 502,
    );
  } finally { timeout.dispose(); }
  if (!upstream.ok) {
    const metadata = await upstreamErrorMetadata(upstream);
    (dependencies.logWarn ?? console.warn)(
      `[CONVERSATE] upstream rejected · status ${upstream.status}`
      + ` · type ${metadata.type} · code ${metadata.code}`,
    );
    const response = openAiError("CONVERSATE_REJECTED", "OpenAI rejected Conversate analysis", 502);
    response.headers.set("x-sandevistan-upstream-status", String(upstream.status));
    response.headers.set("x-sandevistan-upstream-code", metadata.code);
    return response;
  }
  let parsed;
  try {
    parsed = parseConversateResponse(JSON.parse(new TextDecoder().decode(
      await readLimitedBytes(upstream, CONVERSATE_MAX_UPSTREAM_BYTES),
    )));
  } catch { parsed = undefined; }
  return parsed
    ? jsonResponse(parsed, { headers: { "cache-control": "no-store" } })
    : openAiError("CONVERSATE_INVALID", "OpenAI returned invalid Conversate data", 502);
}
