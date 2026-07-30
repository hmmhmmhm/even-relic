import { describe, expect, it } from "vitest";
import { bytesEqual } from "./bytes-equal";

describe("bytesEqual", () => {
  it("matches only byte-identical arrays", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])))
      .toBe(true);
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3])))
      .toBe(false);
    expect(bytesEqual(new Uint8Array([1]), new Uint8Array([1, 2])))
      .toBe(false);
    expect(bytesEqual(undefined, new Uint8Array([1, 2]))).toBe(false);
  });
});
