import { describe, expect, it } from "vitest";
import glassesSource from "./glasses.ts?raw";

const extractedSources = import.meta.glob(
  "./{g2-canvas,fast-canvas-transport}.ts",
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
) as Record<string, string>;

function countLines(source: string) {
  return source.trimEnd().split("\n").length;
}

describe("Canvas transport module boundaries", () => {
  it("keeps every custom transport implementation within 450 lines", () => {
    const sources = {
      "./glasses.ts": glassesSource,
      ...extractedSources,
    };

    for (const [file, source] of Object.entries(sources)) {
      expect(countLines(source), file).toBeLessThanOrEqual(450);
    }
  });

  it("extracts primitives and fast transport without importing glasses", () => {
    expect(Object.keys(extractedSources).sort()).toEqual([
      "./fast-canvas-transport.ts",
      "./g2-canvas.ts",
    ]);
    for (const [file, source] of Object.entries(extractedSources)) {
      expect(source, file).not.toMatch(/from\s+["']\.\/glasses["']/);
    }
  });
});
