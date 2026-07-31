import { describe, expect, it } from "vitest";
import { resolveG2PngEncoderMode } from "./g2-png-encoder-mode";

describe("G2 PNG encoder mode", () => {
  it.each([
    ["?encoder=indexed-2", "indexed-2"],
    ["?pipeline=4&encoder=indexed-2", "indexed-2"],
    ["", "canvas"],
    ["?encoder=canvas", "canvas"],
    ["?encoder=INDEXED-2", "canvas"],
    ["?encoder=bad", "canvas"],
  ] as const)("resolves %s to %s", (search, expected) => {
    expect(resolveG2PngEncoderMode(search)).toBe(expected);
  });
});
