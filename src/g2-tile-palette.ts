export type G2TilePaletteMode = "original" | "hud-4";

export const HUD_FOUR_LEVEL_PALETTE = [0, 128, 208, 255] as const;

export function resolveG2TilePaletteMode(search: string): G2TilePaletteMode {
  return new URLSearchParams(search).get("levels") === "4"
    ? "hud-4"
    : "original";
}

function nearestPaletteValue(value: number): number {
  let nearest: number = HUD_FOUR_LEVEL_PALETTE[0];
  let distance = Math.abs(value - nearest);
  for (const candidate of HUD_FOUR_LEVEL_PALETTE.slice(1)) {
    const nextDistance = Math.abs(value - candidate);
    if (nextDistance < distance) {
      nearest = candidate;
      distance = nextDistance;
    }
  }
  return nearest;
}

export function quantizeHudFourLevelPixels(
  source: Uint8ClampedArray,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(source.length);
  for (let index = 0; index < source.length; index += 4) {
    const intensity = Math.round(
      (
        source[index] * 299
        + source[index + 1] * 587
        + source[index + 2] * 114
      ) / 1000,
    );
    const level = nearestPaletteValue(intensity);
    output[index] = level;
    output[index + 1] = level;
    output[index + 2] = level;
    output[index + 3] = 255;
  }
  return output;
}
