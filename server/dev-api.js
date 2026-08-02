import { handleApiRequest } from "./api-router.js";
import { jsonResponse } from "./http.js";

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function requestHeaders(incoming) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

function configureLocalApi(server) {
  server.middlewares.use(async (incoming, outgoing, next) => {
    const method = incoming.method ?? "GET";
    const host = incoming.headers.host ?? "127.0.0.1";
    const body = method === "GET" || method === "HEAD"
      ? undefined
      : await readRequestBody(incoming);
    const request = new Request(
      new URL(incoming.url ?? "/", `http://${host}`),
      {
        method,
        headers: requestHeaders(incoming),
        body,
      },
    );

    let response;
    try {
      response = await handleApiRequest(request, process.env);
    } catch {
      response = jsonResponse(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "SANDEVISTAN API failed",
          },
        },
        { status: 500 },
      );
    }
    if (!response) {
      next();
      return;
    }

    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => {
      outgoing.setHeader(name, value);
    });
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
}

export function sandevistanDevApi() {
  return {
    name: "sandevistan-dev-api",
    configureServer: configureLocalApi,
    configurePreviewServer: configureLocalApi,
  };
}
