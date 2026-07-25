import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = ["tl", "tr", "bl", "br"].map(
  (tile) => new URL(
    `../public/relic-hud-400x200/relic-${tile}.png`,
    import.meta.url,
  ),
);

test("ships four 200x100 8-bit RGB RELIC HUD tiles", () => {
  for (const file of files) {
    const png = readFileSync(file);
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 200);
    assert.equal(png.readUInt32BE(20), 100);
    assert.equal(png[24], 8);
    assert.equal(png[25], 2);
    assert.ok(png.length > 469);
  }
});
