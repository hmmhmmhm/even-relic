import assert from "node:assert/strict";
import test from "node:test";

import {
  findCurrentBrandViolations,
  findHangulViolations,
  validateRepositoryMetadata,
} from "../scripts/check-repository-copy.mjs";

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
