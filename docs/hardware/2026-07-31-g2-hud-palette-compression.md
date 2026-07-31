# G2 HUD Palette Compression Hardware Gate

Date: 2026-07-31

Status: Ready for physical comparison

Branch: `experiment/g2-pipelined-transport`

## Goal

Determine whether collapsing transmitted Canvas pixels to the four authored HUD
gray levels reduces physical G2 image-refresh latency without compromising
legibility, binocular completeness, or WebView stability.

## Baseline

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&build=pipeline-4-038
```

This route keeps the accepted four-call image pipeline and sends the original
temporary-tile PNG pixels.

## Candidate

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&levels=4&build=palette-4-039
```

This route keeps the same transport but maps only the transmitted tile pixels
to `0`, `128`, `208`, and `255` before PNG encoding. It does not modify the
source HUD Canvas or phone preview.

## Serial comparison sequence

Do not run the baseline and candidate simultaneously.

For each route:

1. Allow one warm-up refresh.
2. Enter and leave a four-tile detail page five times.
3. Move across a two-tile dashboard page five times.
4. Hide and restore the display five times.
5. Leave the WebView idle, then confirm the next input remains responsive.

Use the same phone, Even app, glasses state, HUD data, and interaction cadence.

## Required evidence

For each route, record:

- the `ENCODE` total PNG byte count and per-tile byte counts;
- complete-refresh durations for four-tile and two-tile updates;
- all four quadrants and both-eye completeness;
- clock, weather, news body, TODO, and map-label legibility;
- any persistent tearing, missing tile, timeout, or `sendFailed`;
- whether inputs received while busy are dropped instead of replayed;
- idle and post-idle WebView responsiveness.

The candidate passes only if it reduces total encoded bytes, improves the
median four-tile complete-refresh duration, and preserves every visual and
stability requirement.

## Automated gate

- Vitest: 57 files, 508 tests passed serially.
- TypeScript: passed.
- Repository copy checks: 5 passed serially.
- Production and Sites build: passed.
- Sites worker tests: 4 passed serially.
- Even Hub package: `sandevistan.ehpk`, SDK `0.0.11`.

## Rollback

Remove `levels=4` or return to the baseline URL. No source rollback is needed.
