# Readable Native Ask AI Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unreliable tap-to-pause behavior, pace fast Realtime answers at a readable rate, and localize the complete native Ask AI detail interface for all thirty supported languages.

**Architecture:** Keep Realtime protocol state authoritative and introduce a small presentation pacer that derives a slower `AiHudSnapshot` for rendering only. Keep the one-container native transport, make double tap the sole teardown path, and place complete native-detail copy in a compile-time exhaustive locale map shared by native Text and Canvas fallback formatters.

**Tech Stack:** TypeScript, React controller hooks, Even Hub SDK 0.0.13, OpenAI Realtime WebSocket events, Vitest.

---

### Task 1: Complete native Ask AI localization

**Files:**
- Create: `src/ai-hud-i18n.ts`
- Create: `src/ai-hud-i18n.test.ts`
- Modify: `src/native-ai-text.ts`
- Modify: `src/native-ai-text.test.ts`
- Modify: `src/fast-ai-hud.ts`
- Modify: `src/fast-detail-hud.test.ts`

- [x] **Step 1: Write the failing locale coverage and Korean formatter tests**

Add tests that iterate `SUPPORTED_LOCALES`, require one complete native Ask AI
dictionary per locale, and assert Korean native output contains localized
listening, transcript-history, and double-tap-back labels instead of English.

- [x] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run src/ai-hud-i18n.test.ts src/native-ai-text.test.ts src/fast-detail-hud.test.ts`

Expected: FAIL because the exhaustive native dictionary and localized
formatters do not exist.

- [x] **Step 3: Implement the complete dictionary and shared formatter helpers**

Create the following public API backed by a
`Record<SupportedLocale, AiHudStrings>` containing all thirty locale entries:

```ts
export type AiHudStringKey = keyof AiHudStrings;
export function translateAiHud(
  locale: SupportedLocale,
  key: AiHudStringKey,
): string;
export function localizeAiTranscriptPage(
  page: string,
  locale: SupportedLocale,
): string;
```

The complete string shape is:

```ts
type AiHudStrings = {
  you: string;
  assistant: string;
  ready: string;
  connecting: string;
  listening: string;
  thinking: string;
  displaying: string;
  error: string;
  live: string;
  history: string;
  listeningPrompt: string;
  scrollTranscript: string;
  doubleTapBack: string;
};
```

Use `translatePhone(locale, "ai")` and `translatePhone(locale,
"aiKeyRequired")` for the existing localized title and key prompt. Replace
the remaining English native and Canvas fallback labels through
`translateAiHud`.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command and expect every test to pass.

### Task 2: Add a queue-free readable presentation pacer

**Files:**
- Create: `src/ai-presentation-pacer.ts`
- Create: `src/ai-presentation-pacer.test.ts`
- Modify: `src/ai-hud-state.ts`
- Modify: `src/ai-hud-state.test.ts`
- Modify: `src/ai-runtime.ts`
- Modify: `src/ai-runtime.test.ts`

- [x] **Step 1: Write failing pacer tests**

Cover six graphemes per 250 ms, no intermediate delta queue, immediate
non-assistant status changes, a localized-ready snapshot after backlog drain,
and disposal cancelling the timer.

- [x] **Step 2: Run pacer/runtime tests and verify RED**

Run: `npm test -- --run src/ai-presentation-pacer.test.ts src/ai-runtime.test.ts src/ai-hud-state.test.ts`

Expected: FAIL because presentation pacing is not implemented.

- [x] **Step 3: Add completed turns to the snapshot and implement the pacer**

Extend `AiHudSnapshot` with `turns` so partial assistant frames can rebuild
their transcript pages. Implement:

```ts
export function createAiPresentationPacer(options: {
  onFrame(snapshot: AiHudSnapshot, settled: boolean): void;
  intervalMs?: number;
  graphemesPerTick?: number;
}): {
  push(snapshot: AiHudSnapshot): void;
  reset(): void;
  dispose(): void;
};
```

Each tick reveals at most six `Array.from()` graphemes, rebuilds pages from the
authoritative turns plus partial current text, and uses the `displaying` phase
until caught up. It stores one newest target snapshot rather than delta events.

- [x] **Step 4: Route runtime presentation through the pacer**

Keep protocol state and `stop()` persistence authoritative. Emit only paced
snapshots to the HUD callback, preserve immediate key/error states, and call
the existing final scheduler path when a presented target becomes settled.

- [x] **Step 5: Run focused tests and verify GREEN**

Run the Step 2 command and expect every test to pass.

### Task 3: Make session teardown the sole microphone control

**Files:**
- Modify: `src/ai-realtime-session.ts`
- Modify: `src/ai-realtime-session.test.ts`
- Modify: `src/ai-runtime.ts`
- Modify: `src/ai-runtime.test.ts`
- Modify: `src/fast-hud-view.ts`
- Modify: `src/fast-hud-view.test.ts`
- Modify: `src/fast-hud-input-controller.ts`
- Modify: `src/fast-hud-input-controller.test.ts`

- [x] **Step 1: Write failing input and teardown tests**

Assert a single tap in AI detail returns `consume` with no effect, double tap
stops once and restores Canvas once, and session stop resolves after closing
the socket/subscription even when both microphone-close confirmations fail.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run src/ai-realtime-session.test.ts src/ai-runtime.test.ts src/fast-hud-view.test.ts src/fast-hud-input-controller.test.ts`

Expected: FAIL because tap still invokes pause and failed closure still rejects
stop.

- [x] **Step 3: Remove pause/resume and make stop best effort**

Remove `toggle()` from `AiRuntime`, remove `pause()` and `resume()` from the
Realtime session interface, and make AI detail tap a consumed no-op. During
cleanup, unsubscribe audio and close the socket before attempting microphone
closure twice. For a normal stop, publish idle and return the final protocol
state even when confirmation remains false.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command and expect every test to pass.

### Task 4: Integration and release verification

**Files:**
- Modify: `src/fast-hud-controller.ts`
- Modify: `src/glasses.test.ts`
- Modify: `AGENTS.md` only if implementation reveals a durable decision not
  already captured by the approved design.

- [x] **Step 1: Write the failing integration assertion**

Extend the transport/controller test to prove paced native updates contain
localized listening copy, tap sends no SDK text or microphone command, and
double tap restores the image page despite a false microphone-close result.

- [x] **Step 2: Run integration tests and verify RED**

Run: `npm test -- --run src/glasses.test.ts src/fast-hud-input-controller.test.ts`

Expected: FAIL before the controller uses paced/localized snapshots.

- [x] **Step 3: Wire the approved behavior and keep files under 450 lines**

Use the paced snapshot for native Text and Canvas AI rendering, keep the phone
companion's authoritative cost/history data intact, and preserve external image
suppression while native mode is active.

- [x] **Step 4: Run all verification gates**

Run:

```sh
npm test
npm run typecheck
npm run test:repo
npm run test:sites
npm run pack
git diff --check
```

Expected: all tests and checks pass, `sandevistan.ehpk` is produced, and the
changed implementation files remain at or below 450 lines.

- [ ] **Step 5: Commit, fast-forward main, push, and restart the test server**

Commit the tested implementation, fast-forward `main`, rerun the full test
suite on merged `main`, push `origin/main`, restart port 4179 from `main`, and
verify both localhost and Tailscale `/hud-canvas-fast` return HTTP 200.
