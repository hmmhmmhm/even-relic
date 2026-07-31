# G2 Fast Blank Display Hardware Gate

Date: 2026-07-31

Status: Awaiting physical evidence

Branch: `experiment/g2-fast-blank-display`

## Goal

Determine whether rebuilding the G2 page as one blank full-screen event
container provides a materially faster display-off interaction than sending
four black image tiles, without breaking double-tap recovery, binocular output,
or long-running WebView responsiveness.

This candidate is not an official sleep mode. The Even Hub app, event listener,
live-data session, and phone companion remain active.

## Control

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&build=hide-black-control-047
```

The query-free production route encodes and sends four minimal black PNG tiles
when hiding. A second double tap sends the latest four HUD tiles.

## Candidate

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&hide=blank&build=hide-blank-sdk0013-047
```

The candidate rebuilds the page as one 576×288 blank event-capture text
container. It performs no image encoding or image transfer while hiding. A
second double tap redraws the latest HUD, rebuilds the normal five-container
page, clears the successful-tile cache, and sends all four current tiles.

## Transport invariants

- Only the exact `hide=blank` query selects the candidate.
- Missing, differently cased, or invalid `hide` values use black tiles.
- One accepted input owns the transport; input received while busy is dropped.
- There is no deferred queue, merge, replay, automatic retry, or same-event
  fallback.
- A failed blank rebuild leaves the HUD logically visible.
- A failed restore rebuild leaves the HUD logically hidden.
- Every fresh double tap after a failure may start one new independent attempt.
- A successful restore rebuild forces all four tiles to be sent, even when
  their bytes match the last visible frame.

## Serial comparison procedure

Do not keep both WebViews open. Complete the control run, close it, and only
then open the candidate.

For each route:

1. Confirm startup shows all four quadrants in both eyes.
2. Perform one warm-up hide and restore cycle.
3. Perform ten measured hide and restore cycles.
4. Wait for each `input double-tap complete` record before the next gesture.
5. Record hide duration from `input double-tap accepted` through `complete`.
6. Record restore duration over the same boundary.
7. Confirm every hide produces a visually blank display in both eyes.
8. Confirm every restore returns all four current quadrants in both eyes.
9. Scroll through every dashboard page after the tenth restore.
10. Leave the WebView idle for at least five minutes, then repeat one hide,
    restore, and page scroll.

Use the same phone, Even app, G2 firmware, glasses charge state, location, HUD
content, and interaction cadence for both routes. Do not run unrelated G2
transfers during either measurement.

## Required diagnostics

The control hide should contain one four-tile encode and four tile sends. The
candidate hide should instead contain:

```text
[REFRESH] hide start · strategy blank-rebuild
[REFRESH] blank rebuild success
[REFRESH] hide complete
```

There must be no `ENCODE` or `TILE` entry between the candidate hide start and
hide completion. Candidate restore must contain `restore page rebuild success`,
one four-tile encode, and four successful tile sends.

Record any `sendFailed`, timeout, false rebuild, missing tile, one-eye-only
frame, persistent tearing, ignored post-idle input, close prompt, or WebView
freeze.

## Promotion gate

The candidate passes only when all of the following hold:

- candidate median hide duration is at least 25% lower than the control median;
- all ten measured candidate hides are visually blank in both eyes;
- all ten measured candidate restores show all four current tiles in both eyes;
- there are zero rebuild failures, image-send failures, timeouts, freezes, or
  unexpected close prompts;
- page scrolling and the post-idle hide/restore remain responsive; and
- logs prove the candidate hide performed no image encode or image send.

Automated tests cannot promote this candidate. Physical G2 evidence and the
owner's visual confirmation are mandatory.

## Result table

| Metric | Black-tile control | Blank-rebuild candidate |
| --- | ---: | ---: |
| Measured cycles | Awaiting | Awaiting |
| Median hide | Awaiting | Awaiting |
| Median restore | Awaiting | Awaiting |
| Hide image encodes | Awaiting | Expected: 0 |
| Hide image sends | Awaiting | Expected: 0 |
| Rebuild failures | Awaiting | Awaiting |
| `sendFailed` / timeout | Awaiting | Awaiting |
| Binocular blank hides | Awaiting | Awaiting |
| Complete four-tile restores | Awaiting | Awaiting |
| Five-minute idle recovery | Awaiting | Awaiting |

## Automated evidence

The implementation gate covers strict query resolution, blank and normal page
shape, option propagation, zero-image candidate hide, forced four-tile restore,
failed-hide visibility, failed-restore hidden state, fresh-event recovery,
query-free control behavior, serial test execution, and the 450-line transport
module boundary.

## Rollback

Remove `hide=blank` or use `npm run qr`. No source rollback is required. The
query-free route remains the production behavior throughout this experiment.
