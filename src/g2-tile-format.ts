export type G2TileImageFormat = "png" | "bmp-1";

export function resolveG2TileImageFormat(search: string): G2TileImageFormat {
  return new URLSearchParams(search).get("format") === "bmp1"
    ? "bmp-1"
    : "png";
}

export function rgbaToMonochromeMask(
  source: Uint8ClampedArray,
): Uint8Array {
  const output = new Uint8Array(source.length / 4);
  for (let sourceIndex = 0, outputIndex = 0;
    sourceIndex < source.length;
    sourceIndex += 4, outputIndex += 1) {
    const intensity = Math.round(
      (
        source[sourceIndex] * 299
        + source[sourceIndex + 1] * 587
        + source[sourceIndex + 2] * 114
      ) / 1000,
    );
    output[outputIndex] = intensity >= 128 ? 1 : 0;
  }
  return output;
}
