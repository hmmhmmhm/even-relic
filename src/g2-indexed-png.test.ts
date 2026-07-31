import { unzlibSync } from "fflate";
import { describe, expect, it } from "vitest";
import { encodeG2IndexedPng } from "./g2-indexed-png";

type ParsedChunk = {
  readonly type: string;
  readonly data: Uint8Array;
  readonly crc: number;
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    4,
  ).getUint32(0);
}

function parseChunks(png: Uint8Array): ParsedChunk[] {
  expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  const chunks: ParsedChunk[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = readUint32(png, offset);
    const typeOffset = offset + 4;
    const type = String.fromCharCode(...png.subarray(typeOffset, typeOffset + 4));
    const dataOffset = typeOffset + 4;
    const crcOffset = dataOffset + length;
    chunks.push({
      type,
      data: png.slice(dataOffset, crcOffset),
      crc: readUint32(png, crcOffset),
    });
    offset = crcOffset + 4;
  }
  expect(offset).toBe(png.length);
  return chunks;
}

function testCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunkCrcInput(chunk: ParsedChunk): Uint8Array {
  const type = Uint8Array.from([...chunk.type].map((value) => (
    value.charCodeAt(0)
  )));
  const input = new Uint8Array(type.length + chunk.data.length);
  input.set(type);
  input.set(chunk.data, type.length);
  return input;
}

function grayscalePixels(...values: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(values.flatMap((value) => [
    value,
    value,
    value,
    255,
  ]));
}

describe("G2 two-bit indexed PNG", () => {
  it("writes the minimal indexed PNG chunk structure with valid CRC values", () => {
    const png = encodeG2IndexedPng(1, 1, grayscalePixels(255));
    const chunks = parseChunks(png);

    expect(chunks.map(({ type }) => type)).toEqual([
      "IHDR",
      "PLTE",
      "IDAT",
      "IEND",
    ]);
    for (const chunk of chunks) {
      expect(chunk.crc).toBe(testCrc32(chunkCrcInput(chunk)));
    }
  });

  it("declares two-bit indexed non-interlaced image geometry", () => {
    const [header] = parseChunks(
      encodeG2IndexedPng(5, 2, grayscalePixels(...Array(10).fill(0))),
    );

    expect(readUint32(header.data, 0)).toBe(5);
    expect(readUint32(header.data, 4)).toBe(2);
    expect([...header.data.subarray(8)]).toEqual([2, 3, 0, 0, 0]);
  });

  it("writes the exact four-level grayscale palette", () => {
    const palette = parseChunks(
      encodeG2IndexedPng(1, 1, grayscalePixels(0)),
    ).find(({ type }) => type === "PLTE");

    expect([...palette!.data]).toEqual([
      0, 0, 0,
      128, 128, 128,
      208, 208, 208,
      255, 255, 255,
    ]);
  });

  it("packs four indices per byte and pads a partial final byte", () => {
    const pixels = grayscalePixels(0, 128, 208, 255, 0);
    const idat = parseChunks(encodeG2IndexedPng(5, 1, pixels))
      .find(({ type }) => type === "IDAT");

    expect([...unzlibSync(idat!.data)]).toEqual([
      0,
      0b00011011,
      0,
    ]);
  });

  it("starts every scanline with filter type zero", () => {
    const idat = parseChunks(
      encodeG2IndexedPng(1, 2, grayscalePixels(0, 255)),
    ).find(({ type }) => type === "IDAT");

    expect([...unzlibSync(idat!.data)]).toEqual([
      0, 0b00000000,
      0, 0b11000000,
    ]);
  });

  it("uses the existing luminance and nearest-palette boundaries", () => {
    const pixels = new Uint8ClampedArray([
      64, 64, 64, 1,
      168, 168, 168, 2,
      231, 231, 231, 3,
      232, 232, 232, 4,
      255, 0, 0, 5,
    ]);
    const idat = parseChunks(encodeG2IndexedPng(5, 1, pixels))
      .find(({ type }) => type === "IDAT");

    expect([...unzlibSync(idat!.data)]).toEqual([
      0,
      0b00011011,
      0b01000000,
    ]);
  });

  it("is deterministic and does not mutate source pixels", () => {
    const pixels = grayscalePixels(30, 100, 180, 245);
    const before = pixels.slice();

    const first = encodeG2IndexedPng(4, 1, pixels);
    const second = encodeG2IndexedPng(4, 1, pixels);

    expect([...first]).toEqual([...second]);
    expect(pixels).toEqual(before);
  });

  it.each([
    [0, 1, new Uint8ClampedArray(), "positive integers"],
    [1.5, 1, new Uint8ClampedArray(8), "positive integers"],
    [1, 0, new Uint8ClampedArray(), "positive integers"],
    [2, 1, new Uint8ClampedArray(4), "RGBA length"],
  ] as const)(
    "rejects invalid input %s by %s",
    (width, height, pixels, message) => {
      expect(() => encodeG2IndexedPng(width, height, pixels)).toThrow(message);
    },
  );
});
