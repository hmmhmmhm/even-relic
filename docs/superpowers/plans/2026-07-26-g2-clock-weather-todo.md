# G2 Clock Weather TODO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real render-time `HH:MM:SS` clock, a compact weather line, and Canvas-native TODO checkboxes to the proven tactical HUD.

**Architecture:** Keep `/hud-canvas`, the four-tile transport, and the existing renderer entry point. Add an optional `Date` argument for deterministic time rendering, then update only the time panel and the existing right-side mission card.

**Tech Stack:** TypeScript, HTML Canvas 2D, Vitest, Vite, Even Hub SDK `0.0.10`

---

## File structure

- Modify `src/canvas-hud.test.ts`: inject a fixed date and assert clock, weather,
  TODO labels, boxes, and check path.
- Modify `src/canvas-hud.ts`: format render-time seconds, draw weather, and replace
  mission metadata with Canvas-native TODO controls.
- Modify `README.md`: document the new hardware candidate and static weather.
- Modify `docs/hardware/2026-07-26-first-g2-image-success.md`: add the G2
  acceptance checklist.

### Task 1: Define the new rendering contract

**Files:**
- Modify: `src/canvas-hud.test.ts`

- [ ] **Step 1: Pass a fixed render time**

Replace the renderer call with:

```ts
drawDenseCanvasHud(canvas, new Date(2026, 6, 26, 14, 37, 42));
```

- [ ] **Step 2: Assert the clock, weather, and TODO content**

Use:

```ts
expect(values).toEqual(expect.arrayContaining([
  "14:37:42",
  "HONGDAE  23°C 맑음",
  "TODO // ACTIVE",
  "지하철역으로",
  "이동",
  "경로 확인",
  "02:14",
]));
expect(values).not.toContain("14:37");
expect(values).not.toContain("MISSION ACTIVE");
expect(values).not.toContain("ROUTE UPDATED");

const clock = texts.find(({ value }) => value === "14:37:42");
expect(clock?.font).toContain("22px");
```

Assert the checkbox primitives:

```ts
expect(rectangles).toEqual(expect.arrayContaining([
  { style: "#ffffff", args: [416, 190, 12, 12] },
  { style: "#000000", args: [419, 193, 6, 6] },
  { style: "#aaaaaa", args: [416, 255, 10, 10] },
  { style: "#000000", args: [419, 258, 4, 4] },
]));
expect(strokedPaths).toEqual(expect.arrayContaining([
  expect.objectContaining({
    style: "#ffffff",
    width: 2,
    points: [[418, 260], [420, 263], [425, 257]],
  }),
]));
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
npm test -- src/canvas-hud.test.ts
```

Expected: FAIL because the renderer ignores the date, has no weather, and still
draws `MISSION ACTIVE`.

- [ ] **Step 4: Commit the failing contract**

```bash
git add src/canvas-hud.test.ts
git commit -m "test: define clock weather and TODO HUD contract"
```

### Task 2: Implement the clock, weather, and checkboxes

**Files:**
- Modify: `src/canvas-hud.ts`

- [ ] **Step 1: Format the render-time clock**

Add:

```ts
function formatTime(now: Date) {
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
```

Pass `now` into `drawHeader()`, draw `formatTime(now)` at 22 pixels, draw
`HONGDAE  23°C 맑음` at 9 pixels, and remove the time-panel `// 01`.

- [ ] **Step 2: Add a Canvas checkbox helper**

Add:

```ts
function drawCheckbox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  checked: boolean,
) {
  context.fillStyle = checked ? COLOR.secondary : COLOR.primary;
  context.fillRect(x, y, size, size);
  context.fillStyle = COLOR.background;
  context.fillRect(x + 3, y + 3, size - 6, size - 6);
  if (checked) {
    drawPath(context, [
      [x + 2, y + 5],
      [x + 4, y + 8],
      [x + 9, y + 2],
    ], COLOR.primary, 2);
  }
}
```

- [ ] **Step 3: Replace mission metadata with TODO controls**

Draw:

```ts
drawText(context, "TODO // ACTIVE", 416, 168, 9, COLOR.secondary, "bold");
drawCheckbox(context, 416, 190, 12, false);
drawText(context, "지하철역으로", 434, 187, 16, COLOR.primary, "bold");
drawText(context, "이동", 434, 210, 24, COLOR.primary, "bold");
drawCheckbox(context, 416, 255, 10, true);
drawText(context, "경로 확인", 432, 254, 9, COLOR.secondary, "bold");
drawText(context, "02:14", 520, 254, 9, COLOR.primary, "bold");
```

Remove the old vertical progress rail and `MISSION ACTIVE`/`ROUTE UPDATED`.

- [ ] **Step 4: Pass the optional date through the public renderer**

Use:

```ts
export function drawDenseCanvasHud(
  canvas: HTMLCanvasElement,
  now = new Date(),
) {
  // existing setup
  drawHeader(context, now);
  // existing renderer calls
}
```

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm test -- src/canvas-hud.test.ts
npm test -- --run
```

Expected: 6 test files and 25 tests pass.

Commit:

```bash
git add src/canvas-hud.ts
git commit -m "feat: add clock weather and TODO status to HUD"
```

### Task 3: Document and verify the hardware candidate

**Files:**
- Modify: `README.md`
- Modify: `docs/hardware/2026-07-26-first-g2-image-success.md`

- [ ] **Step 1: Document build `hud-info-003`**

Use this URL:

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=hud-info-003
```

State that clock seconds reflect render time and weather remains mock data.

- [ ] **Step 2: Add G2 checks**

Add:

```markdown
- [ ] `HH:MM:SS`가 시간 프레임 안에서 잘리지 않는다.
- [ ] 지역·온도·날씨 한 줄이 읽힌다.
- [ ] 미완료 상자와 완료 체크가 서로 구분된다.
- [ ] TODO 본문 크기가 이전 미션 카드만큼 크게 유지된다.
```

- [ ] **Step 3: Run fresh verification**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
npm run test:sites
git diff --check
```

Expected: every command exits with status 0.

- [ ] **Step 4: Commit the documentation**

```bash
git add README.md docs/hardware/2026-07-26-first-g2-image-success.md \
  docs/superpowers/specs/2026-07-26-g2-clock-weather-todo-design.md \
  docs/superpowers/plans/2026-07-26-g2-clock-weather-todo.md
git commit -m "docs: add clock weather and TODO hardware candidate"
```

- [ ] **Step 5: Integrate and open the test**

Fast-forward the feature branch to `main`, verify from the merged workspace, push
`main`, then open:

```bash
npx evenhub qr \
  --url 'http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=hud-info-003' \
  --external
```
