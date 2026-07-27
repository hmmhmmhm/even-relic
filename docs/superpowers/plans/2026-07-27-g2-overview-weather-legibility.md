# G2 오버뷰 날씨 보조 정보 가독성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `OVERVIEW` 우측 하단의 체감·습도와 강수·바람 두 줄을 14px로 확대한다.

**Architecture:** 기존 `drawOverview()`의 데이터 흐름, 위치, 색상과 문구는
바꾸지 않고 두 `drawText()` 호출의 크기 인자만 조정한다. 기존 Canvas
수집 테스트에서 두 문구의 실제 폰트 문자열을 확인하여 크기를 고정한다.

**Tech Stack:** TypeScript 5.9, Canvas 2D, Vitest

---

### Task 1: 날씨 보조 정보 두 줄을 14px로 확대

**Files:**
- Modify: `src/fast-canvas-hud.test.ts`
- Modify: `src/fast-canvas-hud.ts`

- [x] **Step 1: 실패 테스트 작성**

기존 실시간 날씨 테스트에 다음 검사를 추가한다.

```ts
const details = weather.texts.filter(({ value }) =>
  value.startsWith("체감 ") || value.startsWith("강수 ")
);
expect(details).toHaveLength(2);
expect(details.every(({ font }) => /\b14px\b/.test(font))).toBe(true);
```

- [x] **Step 2: 실패 확인**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 두 문구의 현재 폰트가 11px이므로 `every()` 검사가 `false`가 되어
실패한다.

- [x] **Step 3: 최소 구현**

`src/fast-canvas-hud.ts`의 두 `drawText()` 호출에서 크기 인자를 11에서
14로 변경한다.

```ts
drawText(
  context,
  `체감 ${Math.round(weather.apparentTemperature)}°  습도 ${Math.round(weather.humidity)}%`,
  308,
  226,
  14,
  COLOR.secondary,
  "bold",
);
drawText(
  context,
  `강수 ${Math.round(weather.precipitationProbability)}%  바람 ${Math.round(weather.windSpeed)}km/h`,
  308,
  248,
  14,
  COLOR.primary,
  "bold",
);
```

- [x] **Step 4: 직렬 검증**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
npm run build
git diff --check
```

Expected: HUD 테스트 10개, 타입 검사, 60개 모듈 빌드와 diff 검사가 모두
통과한다.

- [x] **Step 5: 커밋과 서버 확인**

```bash
git add src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts \
  docs/superpowers/plans/2026-07-27-g2-overview-weather-legibility.md
git commit -m "style: enlarge overview weather details"
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=detail-decks-019'
```

Expected: 커밋이 생성되고 기존 단일 개발 서버의 Tailscale URL이 HTTP
200을 반환한다.
