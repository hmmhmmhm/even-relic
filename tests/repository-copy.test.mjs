import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  findActiveRuntimeHangulViolations,
  findCurrentBrandViolations,
  findHangulViolations,
  findOversizedImplementationFiles,
  validateRepositoryMetadata,
} from "../scripts/check-repository-copy.mjs";

test("findActiveRuntimeHangulViolations rejects fixed Hangul copy", () => {
  assert.deepEqual(
    findActiveRuntimeHangulViolations([{
      path: "src/fast-canvas-transport.ts",
      content: 'onProgress("안경 전송 중");\n',
    }]),
    [{
      path: "src/fast-canvas-transport.ts",
      line: 1,
      message: "Active runtime copy must be locale-neutral",
      excerpt: 'onProgress("안경 전송 중");',
    }],
  );
});

test("findHangulViolations reports the tracked path and one-based line", () => {
  assert.deepEqual(
    findHangulViolations([
      { path: "README.md", content: "# Sandevistan\n\n설명\n" },
      { path: "docs/english.md", content: "English only\n" },
    ]),
    [{
      path: "README.md",
      line: 3,
      message: "Hangul is not allowed in tracked Markdown",
      excerpt: "설명",
    }],
  );
});

test("findCurrentBrandViolations rejects active legacy branding", () => {
  const violations = findCurrentBrandViolations([
    { path: "src/current.ts", content: 'export const title = "RELIC HUD";\n' },
    { path: "package.json", content: '{"name":"even-relic"}\n' },
  ]);

  assert.deepEqual(
    violations.map(({ path, line }) => [path, line]),
    [["src/current.ts", 1], ["package.json", 1]],
  );
});

test("findCurrentBrandViolations permits explicitly marked legacy evidence", () => {
  assert.deepEqual(
    findCurrentBrandViolations([{
      path: "docs/hardware/record.md",
      content: "Legacy evidence: `[TILE] relicTR success`\n",
    }]),
    [],
  );
});

test("validateRepositoryMetadata requires Sandevistan and a private package", () => {
  assert.deepEqual(
    validateRepositoryMetadata({
      packageManifest: { name: "even-relic", private: false },
      appManifest: {
        package_id: "com.hmmhmmhm.evenrelic",
        name: "RELIC",
      },
    }).map(({ field }) => field),
    ["package.name", "package.private", "app.package_id", "app.name"],
  );

  assert.deepEqual(
    validateRepositoryMetadata({
      packageManifest: { name: "sandevistan", private: true },
      appManifest: {
        package_id: "com.hmmhmmhm.sandevistan",
        name: "SANDEVISTAN",
      },
    }),
    [],
  );
});

test("the npm test script limits Vitest discovery to the main src directory", () => {
  const packageManifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.match(packageManifest.scripts.test, /\bvitest run --dir src\b/u);
});

test("findOversizedImplementationFiles enforces the 450-line source limit", () => {
  const oversized = Array.from({ length: 451 }, (_, index) => (
    `export const value${index} = ${index};`
  )).join("\n");

  assert.deepEqual(
    findOversizedImplementationFiles([
      { path: "src/feature.ts", content: oversized },
      { path: "src/feature.test.ts", content: oversized },
      { path: "src/styles.css", content: "body {}\n" },
    ]),
    [{
      path: "src/feature.ts",
      line: 451,
      message: "Implementation file exceeds 450 lines",
      excerpt: "451 lines",
    }],
  );
});
