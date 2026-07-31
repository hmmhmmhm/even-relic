# G2 Two-Bit Indexed PNG Hardware Test

## Status

- Branch: `experiment/g2-indexed-png`
- Automated verification: passed on 2026-07-31
- Physical baseline: transport passed on 2026-07-31
- Physical candidate: transport passed on 2026-07-31
- Default encoder: Canvas
- Promotion decision: rejected for speed; Canvas remains the default

## Automated Verification Record

- `npm test`: 59 files and 534 tests passed.
- `npm run typecheck`: passed.
- `npm run test:repo`: 5 tests passed and repository copy check passed.
- `npm run build`: 156 modules transformed and production build completed.
- `npm run test:sites`: 4 tests passed.
- `node --test --test-concurrency=1 tests/*.test.mjs`: 147 tests passed.
- `npm run pack`: produced `sandevistan.ehpk` at 1,777,391 bytes.
- EHPK SHA-256:
  `bc0fc16b6f8838d4883b2a5078be23ce34cc9328c71f764ef1d99a786d52d4d1`.
- Client source and production bundle scan found no embedded ORS JWT prefix.
- Custom transport files remain within the 450-line repository boundary.

## Canvas Baseline Record

The owner supplied one physical G2 trace from 20:36:56 through 20:37:25.
The trace confirms `palette hud-4 · encoder canvas` for visible frames and
`palette original · encoder canvas` for every hide.

Observed samples:

- Two-tile visible refresh bytes: 9,802 and 9,710; median 9,756 bytes.
- Two-tile visible encode times: 36 and 51 ms; median 43.5 ms.
- Two-tile visible refresh times: 704 and 710 ms; median 707 ms.
- Six hide payloads: 4,704 bytes each.
- Six hide encode times: 24, 26, 24, 22, 26, and 25 ms; median 24.5 ms.
- Six hide refresh times: 330, 480, 364, 362, 363, and 364 ms;
  median 363.5 ms.
- Five restore payloads: 22,860 bytes each.
- Five restore encode times: 93, 85, 91, 86, and 89 ms; median 89 ms.
- Five restore refresh times: 2,185, 2,034, 1,888, 1,972, and 1,915 ms;
  median 1,972 ms.

No `sendFailed`, timeout, retry, pending replay, or queue growth appears in the
submitted trace. Refresh requests arriving during an active operation were
dropped as designed. The trace contains no WebView stall evidence. No separate
four-tile detail sample was included; the five restore samples provide the
recorded full-frame baseline.

## Two-Bit Indexed Candidate Record

The owner supplied one physical G2 trace from 20:40:24 through 20:41:07. The
trace confirms `palette hud-4 · encoder indexed-2` for every visible restore and
`palette original · encoder canvas` for every hide.

Observed samples:

- Eight hide payloads: 4,704 bytes each.
- Eight hide encode times: 33, 25, 20, 30, 29, 24, 16, and 24 ms; median
  24.5 ms.
- Eight hide refresh times: 329, 367, 358, 362, 421, 363, 351, and 335 ms;
  median 360 ms.
- Seven restore payloads: 7,174, 7,174, 7,174, 7,174, 7,174, 7,174, and
  7,141 bytes; median 7,174 bytes.
- Seven restore encode times: 104, 101, 99, 99, 104, 106, and 101 ms; median
  101 ms.
- Seven restore refresh times: 1,887, 1,977, 2,089, 1,969, 2,068, 2,133, and
  2,118 ms; median 2,068 ms.

No `sendFailed`, timeout, retry, pending replay, queue growth, or WebView stall
appears in the submitted candidate trace. One double tap arriving during an
active restore was dropped as designed. No separate two-tile or four-tile
detail candidate sample was included. The user did not report a visual failure,
but the submitted message does not constitute a separate item-by-item visual
check record.

## A/B Decision

For full-frame restore, the indexed encoder reduced the median payload from
22,860 to 7,174 bytes: 15,686 fewer bytes, or a 68.6% reduction. Its median
encode time increased from 89 to 101 ms, and its median end-to-end refresh time
increased from 1,972 to 2,068 ms. The 96 ms increase is a 4.9% regression rather
than a speed improvement.

The hidden-frame path remained effectively unchanged: median encode time was
24.5 ms for both variants, while median refresh time changed from 363.5 to
360 ms. This expected control result does not affect the visible-frame decision.

The indexed PNG is transport-compatible in the supplied run and substantially
smaller, but it does not satisfy the speed-promotion rule. Canvas therefore
remains the default encoder. The indexed implementation and this record remain
on the experiment branch for future SDK or firmware retesting.

## Purpose

This test isolates PNG representation from the already proven transport setup.
Both variants use SDK 0.0.11, four-level visible HUD pixels, four concurrent
tile sends, unchanged-tile skipping, and no refresh queue. Only the visible
tile encoder changes.

The all-black hidden frame always uses the existing Canvas/original path in
both variants.

## Serial Test URLs

Test only one URL at a time. Close or reload the Mini App before switching.

### Canvas baseline

```text
http://100.127.255.11:4178/hud-canvas-fast?sdk=0.0.11&encoder=canvas&build=indexed-baseline-041
```

### Two-bit indexed candidate

```text
http://100.127.255.11:4178/hud-canvas-fast?sdk=0.0.11&encoder=indexed-2&build=indexed-2-041
```

### Known-good main reference

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040
```

The port 4177 server is not part of this experiment and must remain unchanged.

## Preflight

1. Charge the G2 sufficiently for the complete serial run.
2. Confirm both eyes display the current Canvas baseline correctly.
3. Open the WebView trace and clear it before each variant.
4. Use the same phone, G2, physical location, locale, HUD data, and interaction
   sequence for both variants.
5. Perform one unrecorded warm-up refresh after loading each URL.

## Interaction Sequence

For each variant, in this order:

1. Perform five four-tile detail or restore refreshes.
2. Perform five two-tile dashboard page refreshes.
3. Hide the HUD five times with a double tap.
4. Restore the HUD five times with a double tap.
5. Scroll through all HUD pages once.
6. Open and close one detail view.
7. Leave the WebView idle for at least two minute boundaries.

Do not issue a second input while a refresh is active. Busy inputs are expected
to be dropped rather than queued.

## Required Visual Checks

- Both eyes show the same complete frame.
- All four quadrants are present and in the correct location.
- Grayscale levels match the Canvas baseline.
- Text edges, map labels, icons, and weather graphics remain legible.
- No tile is blank, corrupt, stale, shifted, or partially decoded.
- Page order, map zoom direction, detail scrolling, and double-tap hide/restore
  remain unchanged.
- Hidden pixels are fully black.
- The WebView remains responsive after the idle period.

## Measurement Table

Record values from `ENCODE complete` and `REFRESH image refresh complete`.

| Variant | Operation | Run | Bytes | Encode ms | Refresh ms | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Canvas | Four-tile detail | — | — | — | — | No separate sample |
| Canvas | Two-tile visible | 2 | 9,756 median | 43.5 median | 707 median | Pass |
| Canvas | Hide | 6 | 4,704 median | 24.5 median | 363.5 median | Pass |
| Canvas | Restore | 5 | 22,860 median | 89 median | 1,972 median | Pass |
| Indexed | Four-tile detail | — | — | — | — | No separate sample |
| Indexed | Two-tile visible | — | — | — | — | No sample |
| Indexed | Hide | 8 | 4,704 median | 24.5 median | 360 median | Pass |
| Indexed | Restore | 7 | 7,174 median | 101 median | 2,068 median | Stable, slower |

Calculate medians separately for each variant and operation. Do not combine
two-tile, four-tile, hide, and restore samples.

## Diagnostic Expectations

The baseline startup must include:

```text
transport start · pipeline 4 · palette hud-4 · encoder canvas
```

The candidate startup must include:

```text
transport start · pipeline 4 · palette hud-4 · encoder indexed-2
```

Candidate visible refreshes must include `palette hud-4 · encoder indexed-2`.
Every hide refresh must include `palette original · encoder canvas`.

The run must not contain:

- `sendFailed`
- tile timeout
- automatic retry
- pending refresh replay
- refresh queue growth
- WebView stall

## Decision Rules

Accept the experiment as compatible only when every visual and stability check
passes and indexed visible payload bytes are lower than the same Canvas frames.

Consider default promotion only when the indexed median visible refresh or
restore latency also improves enough to be operationally meaningful. Smaller
files without a physical latency improvement remain useful evidence but do not
justify promotion.

Reject the experiment immediately if the G2 displays a blank, corrupt, mixed,
or missing tile, or if any new send failure, timeout, input regression, or stall
appears.

## Rollback

Reload without the encoder parameter or use:

```text
encoder=canvas
```

Canvas remains the code default throughout this test. No test result promotes
the indexed encoder automatically.
