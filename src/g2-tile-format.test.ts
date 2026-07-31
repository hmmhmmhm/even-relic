import { describe, expect, it } from "vitest";
import {
  rgbaToMonochromeMask,
  resolveG2TileImageFormat,
} from "./g2-tile-format";

describe("G2 tile image format", () => {
  it.each([
    ["", "png"],
    ["?format=bmp1", "bmp-1"],
    ["?pipeline=4&format=bmp1", "bmp-1"],
    ["?format=png", "png"],
    ["?format=bmp", "png"],
    ["?format=BMP1", "png"],
    ["?format=bad", "png"],
  ] as const)("resolves %s to %s", (search, expected) => {
    expect(resolveG2TileImageFormat(search)).toBe(expected);
  });

  it("converts RGBA pixels to a deterministic one-bit luminance mask", () => {
    const source = new Uint8ClampedArray([
      0, 0, 0, 255,
      127, 127, 127, 255,
      128, 128, 128, 255,
      255, 255, 255, 0,
      255, 0, 0, 255,
      0, 255, 0, 255,
    ]);
    const snapshot = source.slice();

    expect([...rgbaToMonochromeMask(source)]).toEqual([0, 0, 1, 1, 0, 1]);
    expect(source).toEqual(snapshot);
  });
});
