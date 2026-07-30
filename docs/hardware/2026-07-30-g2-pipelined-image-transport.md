# G2 Pipelined Image Transport Hardware Gate

Date: 2026-07-30

Status: Ready for physical gate

Branch: `experiment/g2-pipelined-transport`

SDK: `@evenrealities/even_hub_sdk` `0.0.11`

Design commit: `8915d1d`

Implementation-plan commit: `691fc29`

Pipeline resolver commit: `8f26dad`

Bounded runner commit: `772493a`

Application routing commit: `4b317c6`

Transport integration commit: `54a0e0f`

## Purpose

Measure whether allowing two G2 image updates to remain in flight inside one
accepted refresh reduces page and detail transition wall-clock time without
reducing display integrity or WebView stability.

This branch does not change the stable SDK, tile geometry, refresh busy gate,
12-second tile timeout, unchanged-tile skip, success-only cache, page rollback,
or the rule that busy refresh requests are dropped rather than deferred.

## Test URLs

Serial baseline:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&build=pipeline-baseline-036`

Pipeline two:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=2&build=pipeline-2-036`

Pipeline three, blocked until every pipeline-two gate passes:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=3&build=pipeline-3-037`

Rollback URL:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&build=pipeline-rollback-036`

## Transport contract

- One 576×288 Canvas is encoded as four 288×144 PNG tiles.
- Full-frame starts retain the order `3 → 5 → 2 → 4`.
- A limit of two starts tiles `3` and `5`, then fills the first available slot
  with tile `2`, followed by tile `4`.
- A limit of three starts tiles `3`, `5`, and `2`, then fills the first
  available slot with tile `4`.
- Missing or invalid `pipeline` values resolve to the serial limit of one.
- Only SDK tile calls inside one accepted refresh overlap.
- Independent input, clock, battery, location, and content refreshes never
  queue, merge, retry, replay, or retain a pending latest value.
- The first observed tile failure prevents new tile starts.
- Calls already in flight are allowed to settle before the refresh fails.
- Only successful tile payloads update the unchanged-tile cache.

## Expected diagnostics

Startup identifies the selected mode:

```text
[APP] transport start · pipeline 2
```

The first two full-frame tile starts identify their bounded in-flight count:

```text
[TILE] sandevistanTR start · 1/4 · inflight 1/2
[TILE] sandevistanBR start · 2/4 · inflight 2/2
```

Each success or failure retains its per-tile duration. Refresh completion
reports the encoding-plus-transfer wall-clock duration:

```text
[REFRESH] image refresh complete · sent 4 · skipped 0 · <duration>ms
```

A new request received while the accepted refresh is active must end
immediately:

```text
[REFRESH] <request> dropped · busy
```

It must not appear later as another accepted operation.

## Serial physical procedure

Use the same phone, Even app, glasses state, network, and HUD content. Run only
one test URL at a time.

1. Open the serial baseline URL.
2. Record startup, a four-tile detail transition, and a two-tile dashboard page
   transition.
3. Confirm all four quadrants, both eyes, page order, detail entry and exit,
   map controls, HUD hide and restore, and input responsiveness.
4. Close the serial run before opening the pipeline-two URL.
5. Repeat the same interactions and retain the complete diagnostics.
6. Confirm there is no `sendFailed`, timeout, missing quadrant, persistent
   tearing, deferred refresh, duplicate action, or WebView freeze.
7. Compare complete-refresh durations with the same-session serial baseline.
8. Test pipeline three only after every pipeline-two item passes.

## Pipeline-two physical checklist

- [ ] Startup completes with all four quadrants.
- [ ] Output appears in both eyes.
- [ ] Full-frame start order is `3 → 5 → 2 → 4`.
- [ ] The logged in-flight count never exceeds `2/2`.
- [ ] General page movement advances exactly one page per accepted input.
- [ ] Overview, News, TODO, Weather, and Navigation detail entry and return work.
- [ ] Map zoom direction and retained zoom state work.
- [ ] News body paging remains inside the article before the next article.
- [ ] TODO items can be checked and unchecked.
- [ ] HUD hide and restore work.
- [ ] Input remains responsive after the app is left open.
- [ ] Busy requests are dropped and never replayed later.
- [ ] No automatic retry occurs after a failed tile.
- [ ] No `sendFailed`, timeout, missing quadrant, persistent tearing, or freeze
  occurs.
- [ ] Complete-refresh duration is lower than the serial baseline.

## Physical evidence

Owner:

Device and Even app version:

Serial baseline log:

Pipeline-two log:

Serial startup duration:

Pipeline-two startup duration:

Serial four-tile detail duration:

Pipeline-two four-tile detail duration:

Serial two-tile page duration:

Pipeline-two two-tile page duration:

Visual observations:

Responsiveness observations:

Result: `PENDING`

## Decision rule

Pipeline two passes only when it is faster than the same-session serial
baseline and every visual, binocular, control, failure, and responsiveness
gate passes. Pipeline three remains blocked until that result is recorded.

If a pipelined mode fails, use `pipeline=1`, keep `main` serial, record the
failure on this branch, and do not promote the failed mode.
