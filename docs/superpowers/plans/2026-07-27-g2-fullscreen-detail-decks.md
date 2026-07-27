# G2 전체 화면 상세 덱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드의 뉴스, TODO, 내비게이션을 한 번 탭하여 열고 안경 제스처로 탐색하거나 조작할 수 있는 576×288 전체 화면 상세 덱으로 구현한다.

**Architecture:** 기존 지도 전용 상태를 공통 상세 화면 상태 기계로 교체한다. RSS 요약과 영속 TODO를 `LiveDashboardState`에 정규화하고, 페이지별 Canvas 렌더러와 현재 상세 화면에 필요한 변화만 네 타일로 보내는 갱신 필터를 분리한다. 모든 입력과 이미지 전송은 기존 직렬 큐를 그대로 사용한다.

**Tech Stack:** Even Hub SDK `0.0.11`, React 19, TypeScript 5.9, Canvas 2D, Vitest, Even 로컬 저장소, RSS

---

구현은 사용자 지시에 따라 서브에이전트 없이 현재 세션에서 직접 진행한다.
승인 명세는
`docs/superpowers/specs/2026-07-27-g2-fullscreen-detail-decks-design.md`와
커밋 `ea42e058d951ea7bd55b657b7c39bacf8d5a7290`이다.

### Task 1: RSS 기사 요약을 정규화하고 캐시에 포함

**Files:**
- Modify: `src/live-state.ts`
- Modify: `src/news.ts`
- Modify: `src/news.test.ts`

- [x] **Step 1: RSS 요약 실패 테스트 작성**

테스트 RSS 첫 항목에 다음 설명을 추가한다.

```xml
<description><![CDATA[
  <p>첫 문장&nbsp;요약입니다.</p>
  <script>제거할 코드</script>
  두 번째 문장입니다.
]]></description>
```

다음 기대값을 추가한다.

```ts
expect(items[0].summary).toBe(
  "첫 문장 요약입니다. 두 번째 문장입니다.",
);
expect(parseNewsRss(longSummaryRss)[0].summary).toHaveLength(360);
```

캐시 테스트에는 `summary`를 포함하고 제어 문자나 361개 이상 요약이 든
캐시가 무시되는 사례를 추가한다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npx vitest run src/news.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: `summary`가 `undefined`라서 실패한다.

- [x] **Step 3: 최소 구현**

`NewsItem`에 다음 필드를 추가한다.

```ts
readonly summary?: string;
```

`news.ts`에 다음 제한을 추가한다.

```ts
const NEWS_SUMMARY_MAX_CODE_POINTS = 360;
```

`sanitizeText()` 결과에서 `script`, `style` 요소를 제거하고 제어 문자를
공백으로 바꾼 뒤 요약을 자른다.

```ts
function sanitizeSummary(value: string): string | undefined {
  const document = new DOMParser().parseFromString(value, "text/html");
  document.querySelectorAll("script,style").forEach((node) => node.remove());
  const clean = (document.body.textContent ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return [...clean].slice(0, NEWS_SUMMARY_MAX_CODE_POINTS).join("");
}
```

`parseNewsRss()`가 `<description>`을 읽고, 캐시 검증과 `cloneItems()`가
요약을 보존하게 한다.

- [x] **Step 4: 통과 확인**

Run:

```bash
npx vitest run src/news.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: 모든 뉴스 테스트와 타입 검사가 통과한다.

- [x] **Step 5: 커밋**

```bash
git add src/live-state.ts src/news.ts src/news.test.ts
git commit -m "feat: retain sanitized RSS summaries"
```

### Task 2: 영속 TODO 모델과 저장소 구현

**Files:**
- Create: `src/todos.ts`
- Create: `src/todos.test.ts`
- Modify: `src/live-state.ts`

- [x] **Step 1: TODO 저장소 실패 테스트 작성**

다음 동작을 검증한다.

```ts
expect(DEFAULT_TODOS).toEqual([
  { id: "station", title: "지하철역으로 이동", completed: false },
  { id: "umbrella", title: "우산 챙기기", completed: false },
  { id: "route", title: "경로 확인", completed: true },
]);

await expect(resolveTodos(emptyStorage)).resolves.toEqual(DEFAULT_TODOS);
await expect(resolveTodos(validStorage)).resolves.toEqual(savedTodos);
await expect(resolveTodos(corruptStorage)).resolves.toEqual(DEFAULT_TODOS);

expect(toggleTodo(DEFAULT_TODOS, 1)[1].completed).toBe(true);
expect(toggleTodo(DEFAULT_TODOS, -1)).toBe(DEFAULT_TODOS);
await expect(writeTodos(failingStorage, changed)).resolves.toBe(false);
```

제목이 비어 있거나 40개 코드 포인트를 넘고, ID가 중복되거나 항목이
6개를 넘는 캐시도 초기값으로 복구하는지 확인한다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npx vitest run src/todos.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: `./todos` 모듈을 찾지 못해 실패한다.

- [x] **Step 3: 최소 구현**

`live-state.ts`에 다음 모델과 상태, 초기값을 추가한다.

```ts
export type TodoItem = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

readonly todos: DataState<readonly TodoItem[]>;

export const DEFAULT_TODOS: readonly TodoItem[];
```

초기 상태에는 `DEFAULT_TODOS`의 세 항목을 `fresh`로 넣는다. 순환 import를
피하기 위해 초기값은 `live-state.ts`가 소유하고 `todos.ts`가 다시
export한다. `todos.ts`는 다음 API를 제공한다.

```ts
export const DEFAULT_TODOS: readonly TodoItem[];
export async function resolveTodos(
  storage: EvenStorage,
): Promise<readonly TodoItem[]>;
export function toggleTodo(
  items: readonly TodoItem[],
  index: number,
): readonly TodoItem[];
export function writeTodos(
  storage: EvenStorage,
  items: readonly TodoItem[],
): Promise<boolean>;
```

`readCache()`와 `writeCache()`의 키는 `"todos"`를 사용하여 실제 저장 키를
`relic:todos:v1`로 고정한다.

- [x] **Step 4: 통과 확인**

Run:

```bash
npx vitest run src/todos.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: TODO 테스트와 타입 검사가 통과한다.

- [x] **Step 5: 커밋**

```bash
git add src/live-state.ts src/todos.ts src/todos.test.ts
git commit -m "feat: persist G2 todo state"
```

### Task 3: 라이브 세션에 TODO 복원과 토글 추가

**Files:**
- Modify: `src/live-dashboard.ts`
- Create: `src/live-dashboard-todo.test.ts`
- Modify: `src/live-dashboard.test.ts`

- [x] **Step 1: 세션 실패 테스트 작성**

`createLiveDashboardSession()` 반환값에 다음 계약을 기대한다.

```ts
toggleTodo(index: number): Promise<boolean>;
```

테스트는 다음을 확인한다.

```ts
await session.start();
expect(session.getState().todos.value).toEqual(savedTodos);

await expect(session.toggleTodo(0)).resolves.toBe(true);
expect(session.getState().todos.value?.[0].completed).toBe(true);
expect(updates.at(-1)?.target).toBe("right");
expect(JSON.parse(bridge.values.get("relic:todos:v1")!)[0].completed)
  .toBe(true);
```

범위 밖 인덱스와 dispose 이후 호출은 `false`를 반환하고 상태나 저장소를
바꾸지 않아야 한다. 저장 실패 후에도 현재 세션의 완료 상태는 유지한다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npx vitest run src/live-dashboard-todo.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: `toggleTodo`가 없어 실패한다.

- [x] **Step 3: 최소 구현**

세션 시작 시 `resolveTodos()`를 호출하고 저장값이 초기 상태와 다를 때
상태를 바꾸고 `right`를 방출한다.

```ts
const toggleTodoAt = async (index: number): Promise<boolean> => {
  const current = state.todos.value ?? [];
  const next = toggleTodo(current, index);
  if (disposed || next === current) return false;
  state = { ...state, todos: { status: "fresh", value: clone(next) } };
  emit("right");
  await writeTodos(options.bridge, next);
  return true;
};
```

메서드는 상태 변경과 전송 요청을 먼저 만들고 저장을 기다린 다음
반환한다.

- [x] **Step 4: 통과 확인**

Run:

```bash
npx vitest run src/live-dashboard.test.ts \
  src/live-dashboard-todo.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: 라이브 세션 테스트와 타입 검사가 통과한다.

- [x] **Step 5: 커밋**

```bash
git add src/live-dashboard.ts src/live-dashboard.test.ts \
  src/live-dashboard-todo.test.ts
git commit -m "feat: expose live todo toggles"
```

### Task 4: 공통 상세 화면 상태 기계 구현

**Files:**
- Create: `src/fast-hud-view.ts`
- Create: `src/fast-hud-view.test.ts`

- [x] **Step 1: 상태 전이 실패 테스트 작성**

테스트 컨텍스트를 다음과 같이 고정한다.

```ts
const context = {
  newsCount: 6,
  todoCount: 3,
  maneuverCount: 4,
  activeManeuverIndex: 1,
};
```

다음 동작을 각각 확인한다.

```ts
expect(enter(initial, "overview", "tap").state.mode).toBe("map");
expect(enter(initial, "news", "tap").state.mode).toBe("news");
expect(enter(initial, "todo", "tap").state.mode).toBe("todo");
expect(enter(initial, "navigation", "tap").state).toMatchObject({
  mode: "navigation",
  navigationIndex: 1,
  navigationFollowsActive: true,
});
```

각 상세 화면의 다음·이전 이동, 경계 `consume`, 두 번 탭 복귀를 확인한다.
TODO 탭은 다음 효과를 반환해야 한다.

```ts
{
  result: "consume",
  effect: { type: "toggle-todo", index: 1 },
}
```

내비게이션 스크롤은 `navigationFollowsActive: false`로 바꾸고, 탭은 현재
동작으로 복귀하며 다시 `true`로 바꾼다. `syncFastHudView()`는 줄어든 항목
수에 맞춰 모든 인덱스를 제한한다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npx vitest run src/fast-hud-view.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 새 상태 모듈이 없어 실패한다.

- [x] **Step 3: 최소 구현**

다음 API를 구현한다.

```ts
export const FAST_MAP_ZOOM_RADII = [850, 650, 500, 375, 280] as const;
export function createFastHudViewState(): FastHudViewState;
export function syncFastHudView(
  state: FastHudViewState,
  context: FastHudViewContext,
): FastHudViewState;
export function reduceFastHudInput(
  state: FastHudViewState,
  page: HudPage,
  input: FastCanvasInput,
  context: FastHudViewContext,
): FastHudTransition;
```

기존 지도 줌 방향과 650m 기본값을 그대로 옮긴다. 대시보드의 스크롤과
두 번 탭은 계속 `unhandled`다. 기존 `fast-map-view.ts`는 App을 새 상태로
옮기는 Task 7까지 유지한다.

- [x] **Step 4: 통과 확인**

Run:

```bash
npx vitest run src/fast-hud-view.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: 상태 전이 테스트와 타입 검사가 통과한다.

- [x] **Step 5: 커밋**

```bash
git add src/fast-hud-view.ts src/fast-hud-view.test.ts
git commit -m "feat: model fullscreen G2 detail input"
```

### Task 5: 전체 화면 뉴스, TODO, 내비게이션 렌더러 구현

**Files:**
- Create: `src/fast-detail-text.ts`
- Create: `src/fast-detail-text.test.ts`
- Create: `src/fast-detail-hud.ts`
- Create: `src/fast-detail-hud.test.ts`
- Modify: `src/fast-canvas-style.ts`

- [x] **Step 1: 줄바꿈 실패 테스트 작성**

```ts
expect(wrapHudText("가나다라마바사", 6, 2)).toEqual([
  "가나다",
  "라마…",
]);
expect(wrapHudText("alpha beta gamma", 10, 2)).toEqual([
  "alpha beta",
  "gamma",
]);
```

빈 문자열, 긴 단어, 한국어와 영문 혼합, 최대 줄 수가 0인 경우도
검증한다.

- [x] **Step 2: 렌더러 실패 테스트 작성**

가짜 Canvas가 그린 텍스트를 수집하여 다음을 확인한다.

```ts
drawFastDetailHud(canvas, {
  mode: "news",
  live,
  newsIndex: 0,
  todoIndex: 0,
  navigationIndex: 0,
});
expect(texts).toContain("NEWS // LIVE");
expect(texts).toContain("01 / 06");
expect(texts.join(" ")).toContain("RSS 요약");

expect(todoTexts).toEqual(expect.arrayContaining([
  "TODO // ACTIVE",
  "완료 1 / 3",
  "TAP // TOGGLE",
]));

expect(navTexts).toEqual(expect.arrayContaining([
  "NAV // ACTIVE",
  "STEP 01 / 02",
  "TAP // CURRENT",
]));
```

모든 렌더링에서 Canvas가 576×288로 설정되고 상태별
`LOADING`, `STALE`, `UNAVAILABLE`, `DISABLED` 문구와
`DOUBLE TAP // BACK`이 보이는지 확인한다.

- [x] **Step 3: 실패 확인**

Run:

```bash
npx vitest run src/fast-detail-text.test.ts \
  src/fast-detail-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 두 모듈이 없어 실패한다.

- [x] **Step 4: 최소 구현**

`fast-detail-text.ts`는 ASCII 1단위, 비 ASCII 2단위로 계산하고 단어
경계를 우선하여 줄을 나눈다. 마지막 줄에 남은 내용이 있으면 2단위
말줄임표 `…`를 넣는다.

`fast-detail-hud.ts`는 다음 API 하나를 제공한다.

```ts
export function drawFastDetailHud(
  canvas: HTMLCanvasElement,
  options: {
    readonly mode: "news" | "todo" | "navigation";
    readonly live: LiveDashboardState;
    readonly newsIndex: number;
    readonly todoIndex: number;
    readonly navigationIndex: number;
  },
): void;
```

공통 헤더, 열린 코너 본문 프레임, 검정 푸터를 그리고 모드별 콘텐츠를
별도 내부 함수로 나눈다. `fast-canvas-style.ts`의 기존 색상, 텍스트,
경로 도구를 재사용한다.

- [x] **Step 5: 통과 확인**

Run:

```bash
npx vitest run src/fast-detail-text.test.ts \
  src/fast-detail-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: 렌더러와 타입 검사가 통과한다.

- [x] **Step 6: 커밋**

```bash
git add src/fast-detail-text.ts src/fast-detail-text.test.ts \
  src/fast-detail-hud.ts src/fast-detail-hud.test.ts \
  src/fast-canvas-style.ts
git commit -m "feat: render fullscreen G2 detail decks"
```

### Task 6: 상세 화면 라이브 갱신 필터 구현

**Files:**
- Create: `src/fast-detail-refresh.ts`
- Create: `src/fast-detail-refresh.test.ts`

- [x] **Step 1: 실패 테스트 작성**

다음 순수 함수를 기대한다.

```ts
export function detailRefreshTarget(
  mode: FastHudViewMode,
  previous: LiveDashboardState,
  next: LiveDashboardState,
  sourceTarget: FastCanvasRefreshTarget,
): FastCanvasRefreshTarget | undefined;
```

테스트는 다음 매핑을 확인한다.

```ts
expect(detailRefreshTarget("dashboard", before, after, "right"))
  .toBe("right");
expect(detailRefreshTarget("map", before, moved, "left")).toBe("all");
expect(detailRefreshTarget("map", before, weather, "right"))
  .toBeUndefined();
expect(detailRefreshTarget("news", before, newsChanged, "right"))
  .toBe("all");
expect(detailRefreshTarget("todo", before, todosChanged, "right"))
  .toBe("all");
expect(detailRefreshTarget("navigation", before, routeChanged, "right"))
  .toBe("all");
expect(detailRefreshTarget("news", before, routeChanged, "all"))
  .toBeUndefined();
```

뉴스는 상태, `fetchedAt`, ID, 제목, 요약, 발행 시각을 비교한다. TODO는
ID, 제목, 완료 상태를 비교한다. 내비게이션은 상태, 목적지, `fetchedAt`,
활성 동작, 표시 거리 버킷, 동작 목록을 비교하며 전체 경로 좌표 배열을
매 위치 갱신마다 직렬화하지 않는다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npx vitest run src/fast-detail-refresh.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 갱신 필터 모듈이 없어 실패한다.

- [x] **Step 3: 최소 구현과 통과 확인**

각 데이터 종류에 작은 동등성 함수를 만들고 보이는 모드의 변화만 `all`로
승격한다.

Run:

```bash
npx vitest run src/fast-detail-refresh.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: 갱신 필터 테스트와 타입 검사가 통과한다.

- [x] **Step 4: 커밋**

```bash
git add src/fast-detail-refresh.ts src/fast-detail-refresh.test.ts
git commit -m "feat: filter fullscreen detail refreshes"
```

### Task 7: App와 직렬 전송 큐 통합

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/glasses.test.ts`
- Delete: `src/fast-map-view.ts`
- Delete: `src/fast-map-view.test.ts`

- [x] **Step 1: App 실패 테스트 작성**

렌더러 모킹에 `drawFastDetailHud`를 추가하고 네 대시보드 탭에서 한 번
탭한 결과를 확인한다.

```ts
await navigate?.("next"); // NEWS
expect(await fastOptions().onInput?.("tap")).toBe("redraw");
expect(mocks.drawDetail).toHaveBeenCalledWith(
  expect.any(HTMLCanvasElement),
  expect.objectContaining({ mode: "news", newsIndex: 0 }),
);
```

TODO 상세에서 스크롤 후 탭하면 `session.toggleTodo(1)`을 정확히 한 번
호출하고 입력 결과는 `consume`이어야 한다. 세션 `onUpdate`가 변경된
TODO를 보내면 `requestRefresh("all")`이 한 번 호출되어야 한다.

뉴스 상세에서 날씨와 경로만 바뀐 업데이트, 모든 상세 화면에서 분과
배터리 변화는 전송하지 않아야 한다. 뉴스, TODO, 경로의 보이는 변화는
`all`을 요청해야 한다. 두 번 탭하면 진입한 대시보드 페이지를 최신 상태로
전체 렌더링해야 한다.

- [x] **Step 2: 전송 실패 테스트 작성**

`glasses.test.ts`에서 뉴스 상세 진입, 스크롤, 복귀에 대응하는 세 번의
`redraw`가 각각 `3/5/2/4`로 직렬 전송되는지 확인한다. 경계 `consume`과
TODO 효과의 `consume`은 입력 자체로 이미지를 보내지 않아야 한다.

- [x] **Step 3: 실패 확인**

Run:

```bash
npx vitest run src/App.test.tsx \
  src/glasses.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 상세 렌더러, 새 상태와 TODO 세션 호출이 없어 실패한다.

- [x] **Step 4: 최소 App 통합**

`App.tsx`의 지도 상태를 `FastHudViewState`로 교체한다. `drawCurrentPage()`
시작 시 현재 항목 수와 활성 동작으로 상태를 동기화하고 다음처럼 그린다.

```ts
if (view.mode === "map") {
  drawFastFullscreenMap(canvas, live, currentMapRadius());
} else if (view.mode !== "dashboard") {
  drawFastDetailHud(canvas, {
    mode: view.mode,
    live,
    newsIndex: view.newsIndex,
    todoIndex: view.todoIndex,
    navigationIndex: view.navigationIndex,
  });
} else {
  drawFastCanvasHud(canvas, new Date(), page, data);
}
```

입력 효과가 `toggle-todo`이면 `liveSession?.toggleTodo(index)`를 기다리고
`consume`을 반환한다. 다른 `redraw`는 기존 방식으로 즉시 Canvas를
그린다.

세션 업데이트에서는 변경 전 상태를 보존하고 `detailRefreshTarget()`으로
전송 대상을 결정한 뒤 상태를 교체한다. 분과 배터리 갱신은
`view.mode === "dashboard"`일 때만 보낸다.

- [x] **Step 5: 전송 문구 일반화**

`fast-canvas-transport.ts`의 `redraw` 완료 문구를
`"상세 화면 전송 완료"`로 바꾼다. 전송 순서와 타일 집합은 변경하지
않는다.

- [x] **Step 6: 통과 확인**

Run:

```bash
npx vitest run src/App.test.tsx \
  src/glasses.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: App, 전송과 타입 검사가 통과한다.

- [x] **Step 7: 파일 길이 확인과 커밋**

Run:

```bash
find src -maxdepth 1 \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) \
  ! -name '*.test.ts' ! -name '*.test.tsx' -print0 |
  xargs -0 wc -l | sort -nr
```

Expected: 모든 구현 파일이 450줄 이하다.

```bash
git add src/App.tsx src/App.test.tsx \
  src/fast-canvas-transport.ts src/glasses.test.ts \
  src/fast-map-view.ts src/fast-map-view.test.ts
git commit -m "feat: open detail decks from every G2 tab"
```

### Task 8: 전체 검증, 문서와 테스트 서버

**Files:**
- Create: `docs/hardware/2026-07-27-g2-fullscreen-detail-decks.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `docs/hardware/2026-07-27-project-completion-audit.md`

- [x] **Step 1: 전체 검증**

Run serially:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 \
  tests/api-router.test.mjs \
  tests/map-api.test.mjs \
  tests/news-api.test.mjs \
  tests/route-api.test.mjs
git grep -n "ORS_API_KEY" -- src app.json package.json
git diff --check
```

Expected: 모든 테스트와 빌드가 통과하고 클라이언트 키 검색은 결과 없이
종료 코드 1을 반환한다.

- [x] **Step 2: 체크포인트 문서 작성**

새 문서에 다음을 기록한다.

```text
SDK: 0.0.11
Build: detail-decks-019
Result: PENDING
```

뉴스 요약, TODO 선택과 저장, 내비게이션 단계, 지도 줌, 복귀, 검정 화면,
양안 네 타일과 `SENDFAILED`를 실제 확인 항목으로 둔다. 자동 검증 수치는
방금 실행한 실제 결과만 기록한다.

- [x] **Step 3: QR과 README 갱신**

`package.json`의 `qr` 빌드 ID를 `detail-decks-019`로 바꾸고 README의 현재
물리 테스트 URL과 상세 덱 제스처를 갱신한다.

- [x] **Step 4: 문서 검증과 커밋**

Run:

```bash
git diff --check
git status --short
```

```bash
git add README.md package.json \
  docs/hardware/2026-07-27-g2-fullscreen-detail-decks.md \
  docs/hardware/2026-07-27-project-completion-audit.md
git commit -m "docs: prepare G2 detail deck checkpoint"
```

- [x] **Step 5: 4176 서버를 한 번만 교체**

기존 `fullscreen-map-018` Vite 세션을 정상 종료하고 포트가 비었는지
확인한다. 새 브랜치에서 다음 서버 하나만 실행한다.

```bash
npm run dev -- --host 0.0.0.0 --port 4176 --strictPort
```

다음 URL의 로컬과 Tailscale 응답이 모두 HTTP 200인지 확인한다.

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=detail-decks-019
```

키가 없는 상태에서 다음 API도 직렬 확인한다.

```text
GET /api/routing-status -> 200 { "enabled": false }
GET /api/news?feed=sbs-latest -> 200 RSS
GET /api/map?... -> 200 normalized OSM
```

- [ ] **Step 6: 실제 G2 대기**

안경 충전 후 체크포인트를 직접 관찰한다. 그전에는 기본 브랜치 통합,
원격 푸시, 완료 알림과 목표 완료 처리를 하지 않는다.
