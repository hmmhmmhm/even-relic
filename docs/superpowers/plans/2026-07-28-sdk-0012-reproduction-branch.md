# Even Hub SDK 0.0.12 Reproduction Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the exact SDK 0.0.12 application state that returned `sendFailed` on a physical G2, with an isolated QR URL and an English reproduction guide for Even Realities.

**Architecture:** Preserve the transport and renderer sources from verified failure commit `7c1053a`. Change only the QR metadata to use localhost port 4177, add evidence-backed reproduction documentation, verify serially, and push branch `0.0.12-reproduce` without disturbing the SDK 0.0.11 server on port 4176.

**Tech Stack:** TypeScript 5.9, React 19, Vite 6, Vitest 4, `@evenrealities/even_hub_sdk` 0.0.12, Even Hub G2 image containers.

---

### Task 1: Isolate the QR contract

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Change the QR contract test first**

Replace the expected QR command with:

```ts
expect(packageManifest.scripts.qr).toBe(
  'evenhub qr --url "http://localhost:4177/hud-canvas-fast?sdk=0.0.12&build=sdk-0012-repro-033"',
);
```

Keep the assertions that the package and app manifest both pin SDK `0.0.12`
and that `ImageRawDataUpdate.toJson()` adds `compressMode: 2`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/sdk-version.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: one test fails because `package.json` still contains port 4176 and
Build `sdk-lz4-030`; the serialization test passes.

- [ ] **Step 3: Change only the QR command**

Set `package.json`:

```json
"qr": "evenhub qr --url \"http://localhost:4177/hud-canvas-fast?sdk=0.0.12&build=sdk-0012-repro-033\""
```

Do not modify the SDK dependency, app manifest, transport, renderer, tile
geometry or send order.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same focused Vitest command.

Expected: 2 tests pass, including the `compressMode: 2` payload contract.

- [ ] **Step 5: Commit the isolated QR metadata**

```bash
git add package.json src/sdk-version.test.ts
git commit -m "chore: isolate SDK 0.0.12 reproduction URL"
```

### Task 2: Publish the evidence-backed English guide

**Files:**
- Create: `SDK-0.0.12-REPRO.md`
- Modify: `README.md`
- Modify: `docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md`

- [ ] **Step 1: Create the English reproduction guide**

Create `SDK-0.0.12-REPRO.md` with these sections and facts:

```markdown
# Even Hub SDK 0.0.12 G2 image send reproduction

This branch preserves the exact application state used when a physical
Even Realities G2 returned `sendFailed` on the first image update.

## Environment

- `@evenrealities/even_hub_sdk`: `0.0.12`
- `app.json` `min_sdk_version`: `0.0.12`
- Display: four 288×144 image containers covering 576×288
- Encoding: standard browser-generated PNG
- Send order: container IDs `3 → 5 → 2 → 4`
- Scheduling: strictly sequential; no parallel send, queue, merge, or retry

## Reproduction

1. Run `npm install`.
2. Run `npm run dev -- --host 0.0.0.0 --port 4177 --strictPort`.
3. Open
   `http://localhost:4177/hud-canvas-fast?sdk=0.0.12&build=sdk-0012-repro-033`.
   When Even Hub runs on another device, replace `localhost` with the
   development computer's LAN address that the device can reach.
4. Observe the first `updateImageRawData` result in `WEBVIEW TRACE`.

## Image update call

```ts
await bridge.updateImageRawData(new ImageRawDataUpdate({
  containerID: tile.id,
  containerName: tile.name,
  imageData: bytes,
}));
```

## Actual result with SDK 0.0.12

The four PNG tiles encode successfully. The first tile, `relicTR`
(container ID 3), returns `sendFailed` in approximately 7ms. No image appears
on either lens and the remaining tiles are not sent.

## Control result with SDK 0.0.11

The same page, PNG encoder, image update call, tile geometry, and strictly
sequential scheduler display successfully on the same physical G2 when the
SDK is pinned to 0.0.11.

## Observed serialization difference

The caller does not set a compression field. In SDK 0.0.12,
`ImageRawDataUpdate.toJson()` automatically includes `compressMode: 2`.
The 0.0.11 payload does not contain that field. This is an observation for
investigation, not a claim that compression is the confirmed root cause.
```

Append the exact physical log:

```text
[15:35:46.275] [ENCODE] start · 4 tiles
[15:35:46.330] [ENCODE] complete · 4 tiles · 55ms
[15:35:46.330] [TILE] relicTR start · 1/4
[15:35:46.337] [ERROR] relicTR failed · sendFailed · 7ms
[15:35:46.338] [ERROR] app startup failed · Error
```

Add source pointers to:

- `src/fast-canvas-transport.ts`
- `src/g2-canvas.ts`
- `src/sdk-version.test.ts`
- `app.json`
- `package.json`

- [ ] **Step 2: Mark the hardware record as failed**

In `docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md`, set
`Result: FAIL`, add the exact physical log, state that the first-image gate
stopped the remaining checks, and state that 0.0.11 is the successful control.

- [ ] **Step 3: Add a reproduction branch banner to README**

At the top of `README.md`, add a short English block that identifies this as
the SDK 0.0.12 reproduction branch and links to `SDK-0.0.12-REPRO.md`.
Do not rewrite the product documentation.

- [ ] **Step 4: Check documentation quality**

Run:

```bash
rg -n "TBD|TODO|FIXME|placeholder" SDK-0.0.12-REPRO.md README.md docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md
git diff --check
```

Expected: no placeholders and no whitespace errors.

- [ ] **Step 5: Commit the reproduction evidence**

```bash
git add SDK-0.0.12-REPRO.md README.md docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md
git commit -m "docs: publish SDK 0.0.12 G2 reproduction"
```

### Task 3: Verify, serve and publish

**Files:**
- Modify after verification:
  `docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md`

- [ ] **Step 1: Run the complete suite serially**

Run each command only after the previous command finishes:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
```

Expected:

- 37 Vitest files and 371 tests pass
- TypeScript exits with code 0
- Vite transforms 67 modules and prepares the Sites build
- 4 Sites tests pass after the build creates `dist`

- [ ] **Step 2: Record exact automated evidence**

Update the hardware record with the exact file count, test count, build module
count and Sites test count from Step 1.

- [ ] **Step 3: Commit verification evidence**

```bash
git add docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md
git diff --cached --check
git commit -m "docs: verify SDK 0.0.12 reproduction branch"
```

- [ ] **Step 4: Start the isolated server**

Confirm port 4177 is free, then run:

```bash
npm run dev -- --host 0.0.0.0 --port 4177 --strictPort
```

Do not stop or restart the SDK 0.0.11 server on port 4176.

- [ ] **Step 5: Verify both servers**

Confirm HTTP 200 for:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=dirty-tiles-032
http://localhost:4177/hud-canvas-fast?sdk=0.0.12&build=sdk-0012-repro-033
```

- [ ] **Step 6: Push the reproduction branch**

```bash
git push -u origin 0.0.12-reproduce
```

Verify `git ls-remote` reports the local HEAD for
`refs/heads/0.0.12-reproduce`.

- [ ] **Step 7: Prepare the official English message**

Provide a concise message that includes:

- the GitHub branch URL;
- the reproduction guide URL;
- the localhost URL and the instruction to substitute a reachable LAN host;
- the user-only Tailscale URL as an optional private check;
- SDK 0.0.12 actual result and SDK 0.0.11 control;
- the automatic `compressMode: 2` observation;
- a request for the expected compression/API contract.
