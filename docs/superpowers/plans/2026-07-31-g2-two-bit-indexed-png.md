# G2 2-Bit Indexed PNG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in deterministic 2-bit indexed PNG encoder for visible G2 HUD tiles while preserving Canvas encoding as the default and for hidden frames.

**Architecture:** A focused PNG module owns index packing, chunk construction, CRC-32, and zlib compression. The existing Canvas crop boundary selects between browser Canvas PNG and indexed PNG using an independent encoder mode, while the fast transport explicitly overrides hidden frames back to Canvas/original. Application query parsing and diagnostics expose the selected mode without changing pipeline, refresh admission, or tile cache behavior.

**Tech Stack:** TypeScript, React, Vitest, Canvas 2D, PNG color type 3, `fflate` zlib, Even Hub SDK 0.0.11

---

## File Structure

- Create `src/g2-png-encoder-mode.ts`: encoder mode type and strict query resolver.
- Create `src/g2-png-encoder-mode.test.ts`: resolver fallback contract.
- Create `src/g2-indexed-png.ts`: deterministic 2-bit indexed PNG construction.
- Create `src/g2-indexed-png.test.ts`: binary format, CRC, packed pixels, validation, determinism, and immutability tests.
- Modify `src/g2-canvas.ts`: select Canvas or indexed encoding after the existing tile crop.
- Modify `src/glasses.test.ts`: cover indexed tile output, Canvas regression, hide override, restore, and transport diagnostics.
- Modify `src/g2-tile-palette.ts` and its test: include encoder mode in byte diagnostics.
- Modify `src/fast-canvas-types.ts`, `src/fast-canvas-session.ts`, and `src/fast-canvas-transport.ts`: carry encoder mode and force Canvas for hidden frames.
- Modify `src/hud-controller-types.ts`, `src/fast-hud-controller.ts`, `src/App.tsx`, and `src/App.test.tsx`: resolve, pass, and log the query-selected mode.
- Modify `package.json` and `package-lock.json`: add `fflate` and serial experiment QR commands.
- Modify experiment documentation with the actual verification and server URLs.

### Task 1: Encoder mode boundary

**Files:**
- Create: `src/g2-png-encoder-mode.ts`
- Create: `src/g2-png-encoder-mode.test.ts`

- [ ] **Step 1: Write the failing resolver test**

```ts
import { describe, expect, it } from "vitest";
import { resolveG2PngEncoderMode } from "./g2-png-encoder-mode";

describe("G2 PNG encoder mode", () => {
  it.each([
    ["?encoder=indexed-2", "indexed-2"],
    ["?pipeline=4&encoder=indexed-2", "indexed-2"],
    ["", "canvas"],
    ["?encoder=canvas", "canvas"],
    ["?encoder=INDEXED-2", "canvas"],
    ["?encoder=bad", "canvas"],
  ] as const)("resolves %s to %s", (search, expected) => {
    expect(resolveG2PngEncoderMode(search)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the resolver test and confirm RED**

Run: `npx vitest run src/g2-png-encoder-mode.test.ts --no-file-parallelism --maxWorkers=1`  
Expected: FAIL because `g2-png-encoder-mode` does not exist.

- [ ] **Step 3: Implement the strict resolver**

```ts
export type G2PngEncoderMode = "canvas" | "indexed-2";

export function resolveG2PngEncoderMode(search: string): G2PngEncoderMode {
  return new URLSearchParams(search).get("encoder") === "indexed-2"
    ? "indexed-2"
    : "canvas";
}
```

- [ ] **Step 4: Run the resolver test and confirm GREEN**

Run: `npx vitest run src/g2-png-encoder-mode.test.ts --no-file-parallelism --maxWorkers=1`  
Expected: 6 tests pass.

- [ ] **Step 5: Commit the encoder mode boundary**

```bash
git add src/g2-png-encoder-mode.ts src/g2-png-encoder-mode.test.ts
git commit -m "feat: resolve G2 PNG encoder mode"
```

### Task 2: Deterministic indexed PNG writer

**Files:**
- Create: `src/g2-indexed-png.ts`
- Create: `src/g2-indexed-png.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the focused compression dependency**

Run: `npm install fflate@0.8.2`  
Expected: `fflate` appears in runtime dependencies and the lockfile remains valid.

- [ ] **Step 2: Write failing binary-format tests**

The test parses the PNG signature and chunks, verifies CRC-32 independently, inflates the single `IDAT` with `unzlibSync`, and asserts these bytes for a 5x1 input:

```ts
const pixels = new Uint8ClampedArray([
  0, 0, 0, 255,
  128, 128, 128, 255,
  208, 208, 208, 255,
  255, 255, 255, 255,
  0, 0, 0, 255,
]);
expect([...unzlibSync(idat)]).toEqual([0, 0b00011011, 0]);
```

Additional tests assert `IHDR` bit depth 2 and color type 3, exact `PLTE`, deterministic output, unchanged input pixels, colored-pixel luminance mapping, invalid dimensions, and invalid RGBA length.

- [ ] **Step 3: Run the writer test and confirm RED**

Run: `npx vitest run src/g2-indexed-png.test.ts --no-file-parallelism --maxWorkers=1`  
Expected: FAIL because `encodeG2IndexedPng` does not exist.

- [ ] **Step 4: Implement the minimal PNG writer**

Implement these exact public and private boundaries:

```ts
export function encodeG2IndexedPng(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
): Uint8Array;

function createChunk(type: string, data: Uint8Array): Uint8Array;
function crc32(bytes: Uint8Array): number;
function packScanlines(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
): Uint8Array;
```

Use `HUD_FOUR_LEVEL_PALETTE`, the current integer luminance formula, nearest-level selection, filter byte 0, four MSB-first indices per byte, one `zlibSync(..., { level: 6 })` stream, and chunk order `IHDR`, `PLTE`, `IDAT`, `IEND`.

- [ ] **Step 5: Run the writer test and confirm GREEN**

Run: `npx vitest run src/g2-indexed-png.test.ts --no-file-parallelism --maxWorkers=1`  
Expected: all indexed writer tests pass.

- [ ] **Step 6: Commit the writer**

```bash
git add package.json package-lock.json src/g2-indexed-png.ts src/g2-indexed-png.test.ts
git commit -m "feat: encode two-bit indexed G2 PNG"
```

### Task 3: Canvas crop integration and diagnostics

**Files:**
- Modify: `src/g2-canvas.ts`
- Modify: `src/g2-tile-palette.ts`
- Modify: `src/g2-tile-palette.test.ts`
- Modify: `src/glasses.test.ts`

- [ ] **Step 1: Write failing Canvas-boundary tests**

Add tests proving:

```ts
await encodeCanvasTiles(source, factory, tiles, {
  paletteMode: "hud-4",
  encoderMode: "indexed-2",
});
```

returns an indexed PNG without calling `toBlob`, preserves the source data, and still performs the existing `drawImage` crop. Add a Canvas-mode test proving `toBlob` is still called. Update the diagnostic expectation to include `encoder indexed-2`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run src/glasses.test.ts src/g2-tile-palette.test.ts --no-file-parallelism --maxWorkers=1`  
Expected: FAIL because `encoderMode` is not accepted and diagnostics omit it.

- [ ] **Step 3: Implement the encoder selection**

Extend the options type:

```ts
export type CanvasTileEncodingOptions = {
  readonly paletteMode?: G2TilePaletteMode;
  readonly encoderMode?: G2PngEncoderMode;
};
```

For `indexed-2`, call `getImageData` after cropping and pass the unmodified pixel buffer to `encodeG2IndexedPng`. For `canvas`, retain the current optional quantize/`putImageData`/`toBlob` flow.

Extend diagnostics:

```ts
formatG2TileEncodingDiagnostic(tiles, paletteMode, encoderMode)
```

and append ` · encoder ${encoderMode}` after the palette field.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx vitest run src/glasses.test.ts src/g2-tile-palette.test.ts --no-file-parallelism --maxWorkers=1`  
Expected: all focused tests pass.

- [ ] **Step 5: Commit Canvas integration**

```bash
git add src/g2-canvas.ts src/g2-tile-palette.ts src/g2-tile-palette.test.ts src/glasses.test.ts
git commit -m "feat: select indexed tile encoding"
```

### Task 4: Application and transport propagation

**Files:**
- Modify: `src/fast-canvas-types.ts`
- Modify: `src/fast-canvas-session.ts`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/hud-controller-types.ts`
- Modify: `src/fast-hud-controller.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/glasses.test.ts`

- [ ] **Step 1: Write failing propagation and hidden-frame tests**

Add application tests that `encoder=indexed-2` passes `tileEncoderMode: "indexed-2"`, while missing and invalid values pass `canvas`. Extend the fast refresh harness to record `options.encoderMode`, then assert:

```ts
expect(encodedEncoderModes).toEqual([
  "indexed-2",
  "canvas",
  "indexed-2",
]);
```

for initial visible, hidden, and restored frames. Assert diagnostics contain both `palette` and `encoder`.
Add a transport case proving `tilePaletteMode: "original"` uses effective
`encoderMode: "canvas"` even when `tileEncoderMode` requests `indexed-2`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run src/App.test.tsx src/glasses.test.ts --no-file-parallelism --maxWorkers=1`  
Expected: FAIL because the mode is not propagated or overridden.

- [ ] **Step 3: Implement propagation and override**

Add `tileEncoderMode: G2PngEncoderMode` to `UseHudControllerOptions` and optional `FastCanvasOptions`. Resolve it in `App`, include it in the controller dependency list and startup log, pass it through `transmitFastCanvas`, and add a final `encoderMode` parameter to `transmitCanvas` defaulting to `canvas`.

Extend `refreshImages` with an encoder argument defaulting to the selected mode.
Before encoding, resolve the effective encoder to `canvas` whenever the refresh
palette is `original`. The hide call also passes both explicit overrides:

```ts
await refreshImages(
  hiddenSource ??= displayToggle.createHiddenSource(),
  tiles,
  "HUD \uD45C\uC2DC \uC228\uAE40 \uC644\uB8CC",
  undefined,
  "original",
  "canvas",
);
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx vitest run src/App.test.tsx src/glasses.test.ts --no-file-parallelism --maxWorkers=1`  
Expected: all focused tests pass.

- [ ] **Step 5: Commit transport propagation**

```bash
git add src/fast-canvas-types.ts src/fast-canvas-session.ts src/fast-canvas-transport.ts src/hud-controller-types.ts src/fast-hud-controller.ts src/App.tsx src/App.test.tsx src/glasses.test.ts
git commit -m "feat: route indexed PNG experiment"
```

### Task 5: Experiment commands, documentation, and full verification

**Files:**
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-07-31-g2-two-bit-indexed-png-design.md`
- Create: `docs/hardware/2026-07-31-g2-two-bit-indexed-png-test.md`

- [ ] **Step 1: Add serial QR commands**

Add scripts using port 4178:

```json
"qr:indexed-baseline": "evenhub qr --url \"http://100.127.255.11:4178/hud-canvas-fast?sdk=0.0.11&encoder=canvas&build=indexed-baseline-041\"",
"qr:indexed2": "evenhub qr --url \"http://100.127.255.11:4178/hud-canvas-fast?sdk=0.0.11&encoder=indexed-2&build=indexed-2-041\""
```

- [ ] **Step 2: Add the physical-test record**

Document the baseline and candidate URLs, strict serial procedure, five-run sample table, visual checks, failure criteria, and the statement that the default remains Canvas until owner approval after physical evidence.

- [ ] **Step 3: Run complete serial verification**

Run each command separately and require exit code 0:

```bash
npm test
npm run typecheck
npm run test:repo
npm run build
npm run test:sites
node --test --test-concurrency=1 tests/*.test.mjs
npm run pack
```

Expected: every suite passes, the build completes, and `sandevistan.ehpk` is produced.

- [ ] **Step 4: Run security and repository checks**

```bash
git diff --check
rg -n "eyJvcmciOi" dist/client src || true
git status --short
```

Expected: no whitespace errors, no client-bundled ORS key, and only intended files are modified.

- [ ] **Step 5: Start the isolated test server and verify both URLs**

Run `npm run dev -- --host 0.0.0.0 --port 4178` from the experiment worktree, then verify both URLs return HTTP 200. Do not stop or modify the main server on port 4177.

- [ ] **Step 6: Commit and push the completed experiment**

```bash
git add package.json package-lock.json docs src
git commit -m "docs: prepare indexed PNG hardware test"
git push origin experiment/g2-indexed-png
```

- [ ] **Step 7: Report handoff**

Report the commit, verification counts, baseline and candidate Tailscale URLs, server state, default/rollback behavior, and the exact physical test sequence. Do not promote the encoder before physical evidence and explicit approval.
