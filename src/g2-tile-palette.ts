export type G2TilePaletteMode = "original" | "hud-4";

export const HUD_FOUR_LEVEL_PALETTE = [0, 128, 208, 255] as const;

export function resolveG2TilePaletteMode(search: string): G2TilePaletteMode {
  return new URLSearchParams(search).get("levels") === "original"
    ? "original"
    : "hud-4";
}

export function formatG2TileEncodingDiagnostic(
  tiles: readonly Uint8Array[],
  mode: G2TilePaletteMode,
): string {
  const lengths = tiles.map(({ byteLength }) => byteLength);
  const total = lengths.reduce((sum, value) => sum + value, 0);
  return `complete · ${tiles.length} tiles · palette ${mode}`
    + ` · bytes ${lengths.join("/")} · total ${total}`;
}

export function hudFourLevelPaletteIndex(
  red: number,
  green: number,
  blue: number,
): number {
  const intensity = Math.round(
    (red * 299 + green * 587 + blue * 114) / 1000,
  );
  let nearestIndex = 0;
  let distance = Math.abs(intensity - HUD_FOUR_LEVEL_PALETTE[nearestIndex]);
  for (let index = 1; index < HUD_FOUR_LEVEL_PALETTE.length; index += 1) {
    const candidate = HUD_FOUR_LEVEL_PALETTE[index];
    const nextDistance = Math.abs(intensity - candidate);
    if (nextDistance < distance) {
      nearestIndex = index;
      distance = nextDistance;
    }
  }
  return nearestIndex;
}

export function quantizeHudFourLevelPixels(
  source: Uint8ClampedArray,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(source.length);
  for (let index = 0; index < source.length; index += 4) {
    const level = HUD_FOUR_LEVEL_PALETTE[hudFourLevelPaletteIndex(
      source[index],
      source[index + 1],
      source[index + 2],
    )];
    output[index] = level;
    output[index + 1] = level;
    output[index + 2] = level;
    output[index + 3] = 255;
  }
  return output;
}
