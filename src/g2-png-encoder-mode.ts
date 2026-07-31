export type G2PngEncoderMode = "canvas" | "indexed-2";

export function resolveG2PngEncoderMode(search: string): G2PngEncoderMode {
  return new URLSearchParams(search).get("encoder") === "indexed-2"
    ? "indexed-2"
    : "canvas";
}
