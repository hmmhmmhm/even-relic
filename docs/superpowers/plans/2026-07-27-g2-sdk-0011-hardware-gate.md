# G2 SDK 0.0.11 Hardware Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin Even Hub SDK `0.0.11` and prove the unchanged fast Canvas HUD transport on the physical G2 before connecting live services.

**Architecture:** Change only dependency/manifest/QR metadata. Keep the current renderer and `ImageRawDataUpdate` call untouched so the physical test isolates the SDK version as the sole transport variable.

**Tech Stack:** Even Hub SDK `0.0.11`, Even Hub CLI, Vite, Vitest, TypeScript

---

### Task 1: Pin SDK 0.0.11 without enabling live data

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`

- [ ] **Step 1: Write the failing SDK pin test**

Replace the first test in `src/sdk-version.test.ts` with:

```ts
it("pins the pre-LZ4 0.0.11 SDK for the fast HUD gate", () => {
  const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

  expect(installed).toBe("0.0.11");
  expect(appManifest.min_sdk_version).toBe(installed);
  expect(packageManifest.scripts.qr).toContain(
    "http://100.96.68.73:4176/hud-canvas-fast",
  );
  expect(packageManifest.scripts.qr).toContain("sdk=0.0.11");
  expect(packageManifest.scripts.qr).toContain("build=fast-live-011");
});
```

Retain the existing serialization test. Its expected JSON must remain:

```ts
{
  containerID: 3,
  containerName: "frame",
  imageData: [1, 2, 3],
}
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run src/sdk-version.test.ts
```

Expected: FAIL because dependency, manifest, and QR metadata still say
`0.0.10`.

- [ ] **Step 3: Install the exact SDK and update metadata**

Run:

```bash
npm install --save-exact @evenrealities/even_hub_sdk@0.0.11
```

Set these exact values in `package.json`:

```json
{
  "scripts": {
    "qr": "evenhub qr --url \"http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fast-live-011\""
  },
  "dependencies": {
    "@evenrealities/even_hub_sdk": "0.0.11"
  }
}
```

Set:

```json
{
  "min_sdk_version": "0.0.11"
}
```

in `app.json`. Do not add permissions or live feature code in this task.

- [ ] **Step 4: Verify the isolated SDK change**

```bash
npx vitest run src/sdk-version.test.ts src/glasses.test.ts src/App.test.tsx
npm run typecheck
npm run build
npm run test:sites
```

Expected: all commands exit `0`; `glasses.test.ts` still asserts startup IDs
`2/3/4/5`, scroll IDs `3/5`, and four-tile hide/restore.

- [ ] **Step 5: Commit the isolated gate build**

```bash
git add package.json package-lock.json app.json src/sdk-version.test.ts
git commit -m "chore: pin Even Hub SDK 0.0.11"
```

### Task 2: Prove SDK 0.0.11 on the physical G2

**Files:**
- Create on success: `docs/hardware/2026-07-27-sdk-0011-transport-success.md`
- Create on failure: `docs/hardware/2026-07-27-sdk-0011-transport-failure.md`

- [ ] **Step 1: Start the hardware test build**

```bash
npm run dev -- --host 0.0.0.0 --port 4176
```

Open this complete Tailscale URL through Even Hub:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fast-live-011
```

- [ ] **Step 2: Run the physical checklist**

Confirm in this order:

1. both lenses show the same `576 x 288` HUD;
2. startup completes with all four quadrants;
3. bottom scroll moves exactly one page and feels as fast as build `008`;
4. top scroll moves exactly one page backward;
5. double tap sends a black frame without closing the app;
6. a second double tap restores the current page;
7. no `SENDFAILED` appears.

- [ ] **Step 3: Record the observed result**

If every check passes, create the success document with:

```markdown
# SDK 0.0.11 G2 Transport Success

Date: 2026-07-27
Build: `fast-live-011`
URL: `/hud-canvas-fast?sdk=0.0.11&build=fast-live-011`
Result: PASS

- Bilateral four-tile startup: PASS
- Bottom/top two-tile paging: PASS
- Double-tap black hide/restore: PASS
- `SENDFAILED`: not observed

SDK `0.0.11` is approved as the live-data baseline. SDK `0.0.12` remains
blocked until separately proven.
```

On success, also add this durable bullet to `AGENTS.md`:

```markdown
- The physical G2 approves SDK `0.0.11` for bilateral four-tile startup,
  two-right-tile paging, and double-tap black hide/restore. Use it as the
  live-data baseline; keep SDK `0.0.12` blocked.
```

If any check fails, create the failure document instead with the exact failing
check and the exact Even Hub status string, keep SDK `0.0.10` as the live
baseline, and stop this roadmap before phase 2.

- [ ] **Step 4: Commit the hardware result**

For success:

```bash
git add docs/hardware/2026-07-27-sdk-0011-transport-success.md AGENTS.md
git commit -m "docs: approve SDK 0.0.11 on physical G2"
```

For failure:

```bash
git add docs/hardware/2026-07-27-sdk-0011-transport-failure.md
git commit -m "docs: record SDK 0.0.11 transport failure"
```

Do not push the roadmap implementation before the user confirms this physical
gate.
