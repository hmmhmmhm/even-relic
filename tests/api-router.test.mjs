import assert from "node:assert/strict";
import test from "node:test";
import { handleApiRequest } from "../server/api-router.js";

test("returns a stable JSON error for an unknown API route", async () => {
  const response = await handleApiRequest(
    new Request("https://example.test/api/missing"),
    {},
  );

  assert.equal(response.status, 404);
  assert.equal(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), {
    error: {
      code: "API_NOT_FOUND",
      message: "Unknown SANDEVISTAN API route",
    },
  });
});

test("returns null for a non-API route", async () => {
  const response = await handleApiRequest(
    new Request("https://example.test/hud-canvas-fast"),
    {},
  );

  assert.equal(response, null);
});
