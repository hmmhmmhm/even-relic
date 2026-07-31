import { zlibSync } from "fflate";
import {
  HUD_FOUR_LEVEL_PALETTE,
  hudFourLevelPaletteIndex,
} from "./g2-tile-palette";

const PNG_SIGNATURE = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10,
]);
const PNG_MAX_DIMENSION = 0x7fffffff;
const PNG_MAX_CHUNK_LENGTH = 0xffffffff;

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function ascii(value: string): Uint8Array {
  return Uint8Array.from([...value].map((character) => (
    character.charCodeAt(0)
  )));
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  if (type.length !== 4) throw new Error("PNG chunk type must be four bytes");
  if (data.length > PNG_MAX_CHUNK_LENGTH) {
    throw new Error("PNG chunk data is too large");
  }
  const typeBytes = ascii(type);
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(8 + data.length, crc32(concatenate([typeBytes, data])));
  return output;
}

function validateInput(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
): void {
  if (
    !Number.isInteger(width)
    || !Number.isInteger(height)
    || width <= 0
    || height <= 0
    || width > PNG_MAX_DIMENSION
    || height > PNG_MAX_DIMENSION
  ) {
    throw new Error("PNG width and height must be positive integers");
  }
  const pixelCount = width * height;
  const expectedLength = pixelCount * 4;
  if (!Number.isSafeInteger(expectedLength) || rgba.length !== expectedLength) {
    throw new Error("PNG RGBA length does not match its dimensions");
  }
  const rowBytes = Math.ceil(width / 4);
  const scanlineLength = (rowBytes + 1) * height;
  if (
    !Number.isSafeInteger(scanlineLength)
    || scanlineLength > PNG_MAX_CHUNK_LENGTH
  ) {
    throw new Error("PNG scanline data is too large");
  }
}

function packScanlines(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
): Uint8Array {
  const rowBytes = Math.ceil(width / 4);
  const scanlines = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (rowBytes + 1);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = (y * width + x) * 4;
      const paletteIndex = hudFourLevelPaletteIndex(
        rgba[pixelOffset],
        rgba[pixelOffset + 1],
        rgba[pixelOffset + 2],
      );
      const byteOffset = rowOffset + 1 + Math.floor(x / 4);
      scanlines[byteOffset] |= paletteIndex << (6 - (x % 4) * 2);
    }
  }
  return scanlines;
}

function createHeader(width: number, height: number): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([2, 3, 0, 0, 0], 8);
  return header;
}

function createPalette(): Uint8Array {
  return Uint8Array.from(HUD_FOUR_LEVEL_PALETTE.flatMap((level) => (
    [level, level, level]
  )));
}

export function encodeG2IndexedPng(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
): Uint8Array {
  validateInput(width, height, rgba);
  const compressed = zlibSync(packScanlines(width, height, rgba), {
    level: 6,
  });
  return concatenate([
    PNG_SIGNATURE,
    createChunk("IHDR", createHeader(width, height)),
    createChunk("PLTE", createPalette()),
    createChunk("IDAT", compressed),
    createChunk("IEND", new Uint8Array()),
  ]);
}
