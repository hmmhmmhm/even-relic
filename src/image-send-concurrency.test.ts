import { describe, expect, it } from "vitest";
import { resolveImageSendConcurrency } from "./image-send-concurrency";

describe("G2 image send concurrency", () => {
  it.each([
    ["", 4],
    ["?pipeline=1", 1],
    ["?pipeline=2", 2],
    ["?pipeline=3", 3],
    ["?pipeline=4", 4],
    ["?pipeline=0", 4],
    ["?pipeline=5", 4],
    ["?pipeline=two", 4],
  ])("resolves %s to %i", (search, expected) => {
    expect(resolveImageSendConcurrency(search)).toBe(expected);
  });
});
