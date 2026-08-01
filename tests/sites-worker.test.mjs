import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  let apiAssetCalls = 0;
  const apiResponse = await worker.fetch(
    new Request("https://example.test/api/missing", {
      headers: { accept: "application/json" },
    }),
    {
      ASSETS: {
        fetch: async () => {
          apiAssetCalls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    },
  );
  assert.equal(apiResponse.status, 404);
  assert.deepEqual(await apiResponse.json(), {
    error: {
      code: "API_NOT_FOUND",
      message: "Unknown SANDEVISTAN API route",
    },
  });
  assert.equal(apiAssetCalls, 0);

  let writeAssetCalls = 0;
  const writeResponse = await worker.fetch(
    new Request("https://example.test/flow", {
      method: "POST",
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => {
          writeAssetCalls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    },
  );
  assert.equal(writeResponse.status, 404);
  assert.equal(writeAssetCalls, 1);
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/server/http.js", import.meta.url));
  await access(new URL("../dist/server/api-router.js", import.meta.url));
  await access(new URL("../dist/server/news.js", import.meta.url));
  await access(new URL("../dist/server/news-feeds.js", import.meta.url));
  await access(new URL("../dist/server/map.js", import.meta.url));
  await access(new URL("../dist/server/route.js", import.meta.url));
  await access(new URL("../dist/server/realtime.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
