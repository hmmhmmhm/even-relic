export function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function readLimitedBytes(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }

  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readLimitedRequestJson(request, maxBytes) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("REQUEST_TOO_LARGE");
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function createTimeout(
  milliseconds,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
) {
  const controller = new AbortController();
  const timer = setTimeoutImpl(() => controller.abort(), milliseconds);
  return {
    signal: controller.signal,
    dispose: () => clearTimeoutImpl(timer),
  };
}
