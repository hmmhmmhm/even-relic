import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sample = readFileSync(
  new URL("../public/evenhub-sample-8bit-200x100.png", import.meta.url),
);

test("ships a 200x100 8-bit RGB PNG for G2", () => {
  assert.equal(sample.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(sample.readUInt32BE(16), 200);
  assert.equal(sample.readUInt32BE(20), 100);
  assert.equal(sample[24], 8);
  assert.equal(sample[25], 2);
});
