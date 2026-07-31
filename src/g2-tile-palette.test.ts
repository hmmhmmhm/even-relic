import { describe, expect, it } from "vitest";
import {
  formatG2TileEncodingDiagnostic,
  HUD_FOUR_LEVEL_PALETTE,
  quantizeHudFourLevelPixels,
  resolveG2TilePaletteMode,
} from "./g2-tile-palette";

describe("G2 transmitted-tile palette", () => {
  it.each([
    ["", "hud-4"],
    ["?levels=4", "hud-4"],
    ["?pipeline=4&levels=4", "hud-4"],
    ["?levels=original", "original"],
    ["?levels=8", "hud-4"],
    ["?levels=04", "hud-4"],
    ["?levels=bad", "hud-4"],
  ] as const)("resolves %s to %s", (search, expected) => {
    expect(resolveG2TilePaletteMode(search)).toBe(expected);
  });

  it("preserves authored HUD palette colors exactly", () => {
    const source = new Uint8ClampedArray(
      HUD_FOUR_LEVEL_PALETTE.flatMap((value) => [
        value,
        value,
        value,
        255,
      ]),
    );

    expect(quantizeHudFourLevelPixels(source)).toEqual(source);
  });

  it("maps intermediate and colored pixels without mutating the source", () => {
    const source = new Uint8ClampedArray([
      30, 30, 30, 12,
      100, 100, 100, 64,
      180, 180, 180, 128,
      245, 245, 245, 0,
      255, 0, 0, 255,
    ]);

    expect([...quantizeHudFourLevelPixels(source)]).toEqual([
      0, 0, 0, 255,
      128, 128, 128, 255,
      208, 208, 208, 255,
      255, 255, 255, 255,
      128, 128, 128, 255,
    ]);
    expect([...source]).toEqual([
      30, 30, 30, 12,
      100, 100, 100, 64,
      180, 180, 180, 128,
      245, 245, 245, 0,
      255, 0, 0, 255,
    ]);
  });

  it("formats actual encoded tile lengths in target order", () => {
    const tiles = [
      new Uint8Array(2),
      new Uint8Array(3),
      new Uint8Array(5),
      new Uint8Array(7),
    ];

    expect(formatG2TileEncodingDiagnostic(
      tiles,
      "hud-4",
      "indexed-2",
    )).toBe(
      "complete · 4 tiles · palette hud-4 · encoder indexed-2"
        + " · bytes 2/3/5/7 · total 17",
    );
  });
});
