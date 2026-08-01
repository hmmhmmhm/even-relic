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

export const OPENAI_SEARCH_MODEL = "gpt-5-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_REQUEST_BYTES = 4_096;
const MAX_UPSTREAM_BYTES = 262_144;
const MAX_QUERY_LENGTH = 500;
const MAX_ANSWER_LENGTH = 8_000;
const MAX_SOURCES = 6;
const SEARCH_TIMEOUT_MS = 15_000;
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,8})?$/;

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
    if (item?.type === "web_search_call") webSearchCalls += 1;
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
  if (!answer) return undefined;
  return {
    answer,
    sources: sources.slice(0, MAX_SOURCES),
    usage: {
      inputTokens: Number.isFinite(value.usage?.input_tokens)
        ? Math.max(0, Math.floor(value.usage.input_tokens))
        : 0,
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
        tools: [{ type: "web_search" }],
        tool_choice: "auto",
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
    await upstream.body?.cancel().catch(() => undefined);
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
