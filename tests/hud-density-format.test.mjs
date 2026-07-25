import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hud = readFileSync(
  new URL("../public/relic-hud-200x100.png", import.meta.url),
);

test("ships the RELIC HUD as a 200x100 8-bit RGB PNG", () => {
  assert.equal(hud.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(hud.readUInt32BE(16), 200);
  assert.equal(hud.readUInt32BE(20), 100);
  assert.equal(hud[24], 8);
  assert.equal(hud[25], 2);
  assert.ok(hud.length > 469, "HUD must not be the 469-byte green sample");
});
