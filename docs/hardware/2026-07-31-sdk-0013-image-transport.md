# SDK 0.0.13 G2 Image Transport Gate

## Status

- Date: 2026-07-31
- Branch: `experiment/g2-sdk-0013`
- Base commit: `09d750bf81314c352cf4e0c2414b9483e304688a`
- Candidate SDK: `@evenrealities/even_hub_sdk` `0.0.13`
- Minimum Even App: `2.2.6`
- Updated G2 firmware: confirmed by the owner
- Automated candidate verification: passed
- Physical candidate verification: pending
- Promotion decision: not requested

## Background

SDK `0.0.12` introduced internal LZ4 compression for image raw-data updates.
On the previously tested Even App and G2 firmware, the first image tile returned
`sendFailed` in approximately 7 ms and no image appeared. The isolated failure
remains preserved on the `0.0.12-reproduce` branch.

Even Realities has reported that the compressed-image problem was repaired. The
owner has installed the current Even App and glasses firmware. The npm registry
now identifies SDK `0.0.13` as latest and its package metadata requires Even App
`2.2.6` or later.

## Isolated Change

The candidate changes only:

- SDK dependency `0.0.11` to `0.0.13`;
- `app.json.min_sdk_version` to `0.0.13`;
- `app.json.min_app_version` to `2.2.6`;
- the candidate QR port, SDK marker, and build marker.

The SDK adds `compressMode: 2` internally when serializing
`ImageRawDataUpdate`. Sandevistan does not add or modify this field itself.

## Preserved Transport Contract

- 576 x 288 Canvas frame split into four 288 x 144 PNG tiles
- Existing Canvas PNG encoder with transmitted `hud-4` levels
- Four in-flight SDK image calls
- Full-frame order `3/5/2/4`
- Right-page order `3/5`
- Byte-level unchanged-tile skipping
- Immediate busy and hidden drops
- No refresh queue, replay, retry, or catch-up processing
- Canvas/original solid-black hide path

## Serial URLs

Open only one Mini App URL at a time.

### SDK 0.0.13 candidate

```text
http://100.127.255.11:4179/hud-canvas-fast?sdk=0.0.13&build=sdk-0013-repair-042
```

### SDK 0.0.11 rollback reference

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040
```

### Serial and original-palette rollback

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&levels=original&build=rollback-serial-original-040
```

## Automated Contract Record

- Focused pre-change test failed for the expected SDK, app version,
  compression flag, and phone metadata mismatches.
- Focused post-change test: 2 files and 4 tests passed.
- `ImageRawDataUpdate.toJson()` returns the original container fields and
  bytes plus `compressMode: 2` under SDK `0.0.13`.
- `npm test`: 57 files and 511 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: 152 modules transformed and the production build completed.
- `npm run test:sites`: 4 tests passed.
- `node --test --test-concurrency=1 tests/*.test.mjs`: 147 tests passed.
- `npm run test:repo`: 5 tests and the repository copy check passed.
- `npm run pack`: produced `sandevistan.ehpk` at 1,772,324 bytes.
- EHPK SHA-256:
  `d5a6ef3378086baa406a78bddd82ca6a5b1fe3ebe4f5a8a0b0e0e74da3e8cda2`.
- Installed versions: Even Hub SDK `0.0.13` and Even Hub CLI `0.1.13`.
- Client source and production bundle contain no embedded ORS credential
  marker.

## Physical Test Sequence

1. Close any active Sandevistan Mini App session.
2. Open the SDK `0.0.13` candidate URL.
3. Stop immediately and copy the trace if the first tile returns `sendFailed`.
4. If startup succeeds, confirm that all four quadrants appear in both eyes.
5. Scroll once through Overview, News, TODO, Weather, and Navigation.
6. Open and close the map, news, TODO, Weather, and Navigation details.
7. Confirm map zoom, continued news text, and TODO toggle behavior.
8. Hide and restore the HUD at least five times.
9. Issue one extra input during an active refresh and confirm it is dropped.
10. Leave the WebView active across two minute boundaries.
11. Copy the complete WebView trace.

## Physical Acceptance Checklist

- [ ] The first image tile does not return `sendFailed`.
- [ ] All four tiles complete and appear in both eyes.
- [ ] No quadrant is blank, corrupt, shifted, mixed, or stale.
- [ ] Page order and input direction are unchanged.
- [ ] Fullscreen detail interactions are unchanged.
- [ ] Repeated hide and restore completes without a stale frame.
- [ ] Busy input is dropped and never replayed later.
- [ ] No automatic retry or refresh queue appears.
- [ ] No tile timeout or unhandled SDK exception appears.
- [ ] The WebView stays responsive across two minute boundaries.

## Failure Rule

Any `sendFailed`, timeout, missing eye, corrupt tile, queued replay, or WebView
stall rejects the candidate. The operation is not retried. SDK `0.0.11` remains
the supported default and the port 4177 rollback server remains available.

Passing this compatibility gate does not automatically promote SDK `0.0.13` to
`main`. A supplied physical trace must be recorded and compared before a
separate promotion decision.
