# G2 Incremental Grid Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the failing one-shot four-image rebuild with an observable 1→2→3→4 image-container diagnostic that retransmits every active tile serially and waits one second after each transfer.

**Architecture:** `src/hud-grid.ts` remains the single hardware-flow module. A page factory will build cumulative stages from the existing `HUD_GRID_TILES`; `transmitHudGrid()` will create stage 1, hold its loading text for three seconds, then rebuild stages 2–4 and stop at the first false result. Every stage sends its active tiles in order because a rebuild may discard earlier image pixels.

**Tech Stack:** TypeScript 5.9, Vite 6, Vitest 4 with jsdom, `@evenrealities/even_hub_sdk` 0.0.11, React 19.

---

## File structure

- `src/hud-grid.ts`: stage-page construction, bridge sequencing, logs, failure boundaries, and double-tap exit.
- `src/hud-grid.test.ts`: exact page shapes, call ordering, cumulative retransmission, and early-stop behavior.
- `src/App.tsx`: visible diagnostic build identifier.
- `src/App.test.tsx`: visible build-identifier regression check.
- `src/sdk-version.test.ts`: Tailscale diagnostic URL and pinned-SDK regression check.
- `package.json`: updated 4180 diagnostic query string.

### Task 1: Stage page factory

**Files:**
- Modify: `src/hud-grid.test.ts`
- Modify: `src/hud-grid.ts`

- [ ] **Step 1: Write the failing page-shape test**

Replace imports of `createLoadingPage` and `createHudGridPage` with
`createHudStagePage`, then add:

```ts
it("builds cumulative stages with loading text only on stage 1", () => {
  const stage1 = createHudStagePage(1, "RELIC HUD LOADING...");
  expect(stage1.containerTotalNum).toBe(2);
  expect(stage1.textObject?.[0].content).toBe("RELIC HUD LOADING...");
  expect(stage1.imageObject?.map((image) => image.containerName)).toEqual([
    "relicTL",
  ]);

  const stage4 = createHudStagePage(4, " ");
  expect(stage4.containerTotalNum).toBe(5);
  expect(stage4.textObject?.[0].content).toBe(" ");
  expect(stage4.imageObject?.map((image) => image.containerName)).toEqual([
    "relicTL",
    "relicTR",
    "relicBL",
    "relicBR",
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run src/hud-grid.test.ts
```

Expected: FAIL because `createHudStagePage` is not exported.

- [ ] **Step 3: Implement the minimal stage-page factory**

In `src/hud-grid.ts`, replace `createLoadingPage()` and
`createHudGridPage()` with:

```ts
export function createHudStagePage(
  tileCount: number,
  content: string,
) {
  const tiles = HUD_GRID_TILES.slice(0, tileCount);
  return new CreateStartUpPageContainer({
    containerTotalNum: tiles.length + 1,
    textObject: [createEventLayer(content)],
    imageObject: tiles.map((tile) => new ImageContainerProperty(tile)),
  });
}
```

The caller only passes `1` through `4`; do not add unrelated configuration or
validation.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npx vitest run src/hud-grid.test.ts
```

Expected: the page-shape test passes. Sequencing tests may still fail until
Task 2 and must not be weakened to accommodate the old flow.

- [ ] **Step 5: Commit the page factory**

```powershell
git add -- src/hud-grid.ts src/hud-grid.test.ts
git commit -m "refactor: model cumulative G2 HUD stages"
```

### Task 2: Incremental bridge sequence

**Files:**
- Modify: `src/hud-grid.test.ts`
- Modify: `src/hud-grid.ts`

- [ ] **Step 1: Write the failing successful-sequence test**

Build a bridge fake that records the number of image containers in every page,
text updates, image sends, and delays. Assert this exact sequence:

```ts
expect(calls).toEqual([
  "create:1",
  "wait:3000",
  "text: ",
  "send:relicTL",
  "wait:1000",
  "rebuild:2",
  "send:relicTL",
  "wait:1000",
  "send:relicTR",
  "wait:1000",
  "rebuild:3",
  "send:relicTL",
  "wait:1000",
  "send:relicTR",
  "wait:1000",
  "send:relicBL",
  "wait:1000",
  "rebuild:4",
  "send:relicTL",
  "wait:1000",
  "send:relicTR",
  "wait:1000",
  "send:relicBL",
  "wait:1000",
  "send:relicBR",
  "wait:1000",
]);
```

The fake must return `0` from `createStartUpPageContainer`, `true` from
`rebuildPageContainer` and `textContainerUpgrade`, and `"success"` from
`updateImageRawData`.

- [ ] **Step 2: Write the failing rebuild-boundary test**

Make stage 2 rebuild return `true` and stage 3 rebuild return `false`. Assert
that `transmitHudGrid()` rejects with `STAGE 3 REBUILD FAILED`, that no
`rebuild:4` call occurs, and that no BL or BR image is loaded after the false
result:

```ts
await expect(transmitHudGrid(report, dependencies))
  .rejects.toThrow("STAGE 3 REBUILD FAILED");

expect(calls).not.toContain("rebuild:4");
expect(reports).toContain("STAGE 3 REBUILD RESULT: false");
expect(reports).not.toContain("STAGE 3 relicBL LOAD");
```

- [ ] **Step 3: Write the failing image-boundary test**

Return `"sendFailed"` for stage 2 TR and assert:

```ts
await expect(transmitHudGrid(report, dependencies))
  .rejects.toThrow("STAGE 2 relicTR 전송 실패: sendFailed");

expect(reports).not.toContain("STAGE 3 REBUILDING 3 IMAGES");
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```powershell
npx vitest run src/hud-grid.test.ts
```

Expected: FAIL because the production flow still performs a single four-image
rebuild and has no per-stage waits or logs.

- [ ] **Step 5: Add text-upgrade support to the bridge type**

Import `TextContainerUpgrade` and add:

```ts
textContainerUpgrade: (update: TextContainerUpgrade) => Promise<boolean>;
```

to `HudGridBridge`.

- [ ] **Step 6: Implement stage creation, loading hold, and clearing**

Replace the current startup block in `transmitHudGrid()` with:

```ts
const startupPage = createHudStagePage(1, "RELIC HUD LOADING...");
report("STAGE 1 STARTUP CREATING 1 IMAGE");
const created = StartUpPageCreateResult.normalize(
  await bridge.createStartUpPageContainer(startupPage),
);
const resultName = StartUpPageCreateResult[created];
report(`STAGE 1 STARTUP RESULT: ${resultName}`);

if (created === StartUpPageCreateResult.invalid) {
  const rebuilt = await bridge.rebuildPageContainer(toRebuildPage(startupPage));
  report(`STAGE 1 REBUILD RESULT: ${rebuilt}`);
  if (!rebuilt) throw new Error("STAGE 1 REBUILD FAILED");
} else if (created !== StartUpPageCreateResult.success) {
  throw new Error(`STAGE 1 STARTUP FAILED: ${resultName}`);
}

report("STAGE 1 LOADING READY - WAIT 3S");
await dependencies.waitForPageReady(3000);
report("STAGE 1 LOADING WAIT COMPLETE");

const cleared = await bridge.textContainerUpgrade(new TextContainerUpgrade({
  containerID: 1,
  containerName: "eventLayer",
  content: " ",
}));
report(`STAGE 1 LOADING CLEAR RESULT: ${cleared}`);
```

Do not stop when `cleared` is false; the diagnostic is testing image pages.

- [ ] **Step 7: Implement cumulative rebuild and retransmission**

Use one outer stage loop and one inner serial tile loop:

```ts
for (let tileCount = 1; tileCount <= HUD_GRID_TILES.length; tileCount += 1) {
  const stage = tileCount;
  if (stage > 1) {
    report(`STAGE ${stage} REBUILDING ${tileCount} IMAGES`);
    const rebuilt = await bridge.rebuildPageContainer(
      toRebuildPage(createHudStagePage(tileCount, " ")),
    );
    report(`STAGE ${stage} REBUILD RESULT: ${rebuilt}`);
    if (!rebuilt) throw new Error(`STAGE ${stage} REBUILD FAILED`);
  }

  for (const tile of HUD_GRID_TILES.slice(0, tileCount)) {
    report(`STAGE ${stage} ${tile.containerName} LOAD`);
    const bytes = await dependencies.loadBytes(tile.file);
    const result = ImageRawDataUpdateResult.normalize(
      await bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: tile.containerID,
        containerName: tile.containerName,
        imageData: bytes,
      })),
    );
    report(`STAGE ${stage} ${tile.containerName} RESULT: ${result}`);
    if (!ImageRawDataUpdateResult.isSuccess(result)) {
      throw new Error(
        `STAGE ${stage} ${tile.containerName} 전송 실패: ${result}`,
      );
    }
    await dependencies.waitForPageReady(1000);
    report(`STAGE ${stage} ${tile.containerName} WAIT 1S COMPLETE`);
  }
}
```

Keep the existing double-tap subscription after successful stage 4 completion.

- [ ] **Step 8: Run focused and full tests**

Run:

```powershell
npx vitest run src/hud-grid.test.ts
npm test
```

Expected: focused HUD-grid tests pass, followed by all project test files with
zero failures.

- [ ] **Step 9: Commit the incremental sequence**

```powershell
git add -- src/hud-grid.ts src/hud-grid.test.ts
git commit -m "fix: grow G2 HUD grid one image at a time"
```

### Task 3: Build identity, static preview, and handoff

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing build-identity assertions**

Change the expected visible label and QR query to:

```ts
expect(screen.getByText("v0.1.0 · hud400-step1")).toBeTruthy();
expect(packageManifest.scripts.qr).toContain("build=hud400-step1");
```

- [ ] **Step 2: Run the identity tests and verify RED**

Run:

```powershell
npx vitest run src/App.test.tsx src/sdk-version.test.ts
```

Expected: FAIL because production still contains `hud400-text3s`.

- [ ] **Step 3: Update the production build identity**

In `src/App.tsx`:

```ts
const DIAGNOSTIC_BUILD = "hud400-step1";
```

In `package.json`:

```json
"qr": "evenhub qr --url http://100.84.176.81:4180/hud-density-v2?sdk=0.0.11&build=hud400-step1"
```

- [ ] **Step 4: Verify tests, types, build, asset formats, and source size**

Run:

```powershell
npm test
npm run typecheck
npm run build
npm run test:sites
(Get-Content src\hud-grid.ts).Count
(Get-Content src\hud-grid.test.ts).Count
git diff --check
```

Expected: 35 or more tests pass, typecheck and build exit 0, seven site/format
tests pass, both TypeScript files remain at or below 450 lines, and
`git diff --check` reports no errors.

- [ ] **Step 5: Verify the existing 4180 static server serves the new bundle**

Run:

```powershell
$uri = "http://100.84.176.81:4180/hud-density-v2?sdk=0.0.11&build=hud400-step1"
$page = Invoke-WebRequest -UseBasicParsing -Uri $uri
$asset = [regex]::Match($page.Content, 'src="([^"]+\.js)"').Groups[1].Value
$bundle = Invoke-WebRequest -UseBasicParsing -Uri ("http://100.84.176.81:4180" + $asset)
$page.StatusCode
$page.Content.Contains("/@vite/client")
$bundle.Content.Contains("hud400-step1")
$bundle.Content.Contains("STAGE 4 REBUILD RESULT")
Get-NetTCPConnection -LocalPort 4180 -State Listen
```

Expected: status `200`, Vite-client check `False`, both bundle-content checks
`True`, and exactly one listener on port 4180.

- [ ] **Step 6: Commit and push the build identity**

```powershell
git add -- package.json src/App.tsx src/App.test.tsx src/sdk-version.test.ts
git commit -m "chore: label incremental G2 grid diagnostic"
git push
git status --short
```

Expected: push succeeds and `git status --short` is empty.

- [ ] **Step 7: Hand off the hardware test**

Provide:

```text
http://100.84.176.81:4180/hud-density-v2?sdk=0.0.11&build=hud400-step1
```

Ask for the last visible `STAGE N ... RESULT` line and whether each successful
stage was visible on the glasses. Do not claim the hardware issue is fixed
until the real G2 run confirms stage 4.
