# G2 2-Bit Indexed PNG Experiment Design

**Date:** 2026-07-31  
**Branch:** `experiment/g2-indexed-png`  
**Status:** Implemented and automatically verified; awaiting physical A/B test

## Summary

Sandevistan currently uses four-level grayscale HUD rendering, four concurrent G2 image sends, and unchanged-tile skipping. Physical testing confirmed that this default is stable and materially faster than the original full-color Canvas PNG path.

The next experiment will determine whether encoding those same four grayscale levels as a true 2-bit indexed PNG reduces transfer bytes and end-to-end display latency further. The experiment is strictly opt-in. It must not alter the current default, the proven hidden-screen path, interaction semantics, refresh admission rules, or tile transmission pipeline.

## Goals

- Encode visible HUD tiles as deterministic PNG images with a 2-bit indexed color model.
- Preserve the exact four grayscale levels already used by the `hud-4` palette.
- Reduce visible-frame payload size and measure whether that produces a meaningful physical latency improvement.
- Keep `pipeline=4`, no-queue refresh admission, unchanged-tile skipping, and the existing tile layout unchanged.
- Provide an immediate query-string rollback to the current Canvas encoder.
- Produce diagnostics that make Canvas and indexed results directly comparable.

## Non-Goals

- Changing the HUD design, typography, antialiasing policy, page content, or tile geometry.
- Changing navigation, tap, double-tap, scroll, sleep, or restore behavior.
- Replacing the SDK image containers or layering additional containers.
- Promoting the indexed encoder to the default without a separate physical-test decision.
- Re-encoding the all-black hidden frame with the experimental encoder.
- Adding retries, pending refreshes, queues, or catch-up processing.

## Existing Baseline

The production candidate on `main` uses:

- four 288x144 image tiles covering the 576x288 display;
- `pipeline=4` concurrent sends;
- `levels=hud-4` for visible HUD frames;
- the existing Canvas PNG encoder;
- byte-level unchanged-tile skipping;
- the existing Canvas/original path for the all-black hidden frame;
- fail-fast refresh admission: a refresh arriving while another refresh is active is dropped.

The opt-in experiment must be measured against this exact behavior, changing only the visible-frame PNG encoder.

## User-Facing Experiment Controls

Add one independent query parameter:

```text
encoder=canvas
encoder=indexed-2
```

Resolution rules:

- `encoder=indexed-2` selects the experimental encoder.
- `encoder=canvas`, a missing value, or any unknown value selects the existing Canvas encoder.
- The default remains `canvas`.
- `levels` and `pipeline` retain their current independent behavior.
- Indexed encoding is effective only when the refresh palette is `hud-4`.
  A refresh using `levels=original` uses Canvas even if the URL requests
  `encoder=indexed-2`, because a four-entry indexed file cannot preserve the
  original color space.

Recommended serial physical-test URLs on the dedicated experiment server are:

```text
Baseline:
http://100.127.255.11:4178/hud-canvas-fast?sdk=0.0.11&encoder=canvas&build=indexed-baseline-041

Candidate:
http://100.127.255.11:4178/hud-canvas-fast?sdk=0.0.11&encoder=indexed-2&build=indexed-2-041
```

Only one URL may be tested at a time. The existing main server on port 4177 remains available as an independent rollback reference.

## Architecture

### Encoder mode

Introduce a narrow transport type:

```ts
type G2PngEncoderMode = "canvas" | "indexed-2";
```

The resolved mode flows through the existing application and fast-transport options into tile encoding. It remains separate from `G2TilePaletteMode`, because palette choice describes pixels while encoder choice describes their PNG representation.

### Existing Canvas path

When the mode is `canvas`, preserve the current flow without behavioral changes:

1. Copy the requested source region to the temporary tile canvas.
2. Apply `hud-4` quantization when requested.
3. Call `canvas.toBlob("image/png")`.
4. Convert the blob to `Uint8Array`.

Existing Canvas-focused tests remain the regression contract for this path.

### Indexed path

When the mode is `indexed-2`, visible `hud-4` tiles use a deterministic PNG writer:

1. Copy the requested source region to the temporary tile canvas.
2. Read its RGBA pixels once.
3. Map every pixel directly to the nearest existing HUD grayscale level using the same luminance and threshold behavior as current `hud-4` quantization.
4. Store the corresponding palette index from 0 through 3 without writing the quantized pixels back to the source canvas.
5. Pack four 2-bit indices per byte, most-significant index first. Start each scanline with PNG filter type `0` (None). Pad unused low bits at the end of a non-multiple-of-four row with zeroes.
6. Compress the complete scanline buffer as one zlib stream.
7. Emit a deterministic indexed PNG.

The source canvas and source pixel data must not be mutated.

If the requested palette is `original`, the effective encoder is `canvas`.
This compatibility rule is resolved before encoding and the diagnostic reports
the effective mode, so it never labels an original-color Canvas payload as an
indexed payload.

## PNG Binary Format

The generated file contains exactly these chunks in order:

1. PNG signature
2. `IHDR`
3. `PLTE`
4. `IDAT`
5. `IEND`

### IHDR

- Width and height: requested tile dimensions, big-endian.
- Bit depth: `2`.
- Color type: `3` (indexed color).
- Compression method: `0`.
- Filter method: `0`.
- Interlace method: `0`.

### PLTE

The palette contains four opaque grayscale entries in index order:

```text
0: #000000
1: #808080
2: #D0D0D0
3: #FFFFFF
```

No `tRNS` chunk is emitted because every HUD pixel is opaque.

### IDAT

- Contains one zlib stream over all filter-prefixed scanlines.
- Uses `fflate`'s named `zlibSync` export with a fixed compression level of 6.
- Emits one `IDAT` chunk to keep output and tests deterministic.

### Chunk integrity

- Every chunk length is unsigned 32-bit big-endian.
- Every CRC-32 covers the chunk type followed by the chunk data.
- No timestamp, text, color-profile, or other metadata chunks are emitted.
- Identical pixels and dimensions must produce identical bytes.

## Compression Dependency

Use `fflate` as a runtime dependency and import only `zlibSync`. This gives the experiment a small, synchronous, deterministic zlib implementation suitable for the small per-tile scanline buffers and allows bundlers to remove unused library features.

The native `CompressionStream("deflate")` API is not selected for this experiment. Although it produces a zlib stream, its availability in the embedded Even Reality WebView is not established, and its asynchronous stream boundary would add a separate compatibility variable to a test intended to isolate PNG representation.

## Hidden Screen and Restore

The hidden screen is a proven special case and remains outside the experiment:

- Hiding the HUD always uses `palette=original` and `encoder=canvas` for the four black tiles.
- Restoring the HUD resumes the URL-selected palette and encoder.
- Diagnostics must show that override explicitly.
- The black hidden-frame payload is not part of the indexed encoder success criterion.

This preserves the physically verified hide latency and ensures an indexed-decoder incompatibility cannot prevent the display from being blanked.

## Refresh and Transport Semantics

No transport semantics change:

- Encode the accepted refresh once.
- Compare final encoded bytes with the last successful payload for each tile.
- Skip unchanged tiles.
- Send changed tiles with the existing resolved concurrency, currently four.
- Do not enqueue a busy refresh.
- Do not retry a failed send.
- Do not replay dropped events after the active refresh finishes.
- Commit display state only after all changed tiles succeed.

There is no automatic Canvas fallback after an indexed refresh is accepted. A failure is logged and remains a failure. Automatic per-tile fallback could create a mixed frame and would invalidate the A/B measurement. Reloading with `encoder=canvas` is the rollback.

## Diagnostics

Startup diagnostics must include both independent choices:

```text
transport start · pipeline 4 · palette hud-4 · encoder indexed-2
```

Each encode completion must include:

```text
palette hud-4 · encoder indexed-2 · bytes A/B/C/D · total N · Xms
```

Canvas runs use `encoder canvas`. Hide runs must report `palette original · encoder canvas` even when the URL selects `indexed-2`.

Existing tile start, inflight, success, failure, refresh completion, unchanged skip, busy drop, and display commit diagnostics remain unchanged.

## Error Handling

The indexed writer validates its input before invoking the SDK:

- width and height must be positive integers;
- RGBA data length must equal `width * height * 4`;
- packed scanline size must fit safe JavaScript allocation limits;
- chunk payload sizes must fit unsigned 32-bit PNG lengths.

Invalid input or encoding failure rejects the active refresh. It must not silently switch encoders, retry, or schedule later work. The next independent user or live-data event may attempt a new refresh under the normal admission rules.

## Test Strategy

Implementation follows test-driven development. Tests are run serially.

### Unit tests

- Resolve only the exact `indexed-2` literal to the experimental mode.
- Preserve `canvas` as the missing, explicit, and invalid-value fallback.
- Verify PNG signature and exact chunk order.
- Verify all chunk lengths and CRC-32 values.
- Verify `IHDR` dimensions, bit depth 2, color type 3, and method fields.
- Verify the exact four-entry `PLTE` payload.
- Inflate `IDAT` with `unzlibSync` and verify filter bytes and packed indices.
- Cover widths divisible and not divisible by four.
- Cover all four grayscale indices and boundary luminance values.
- Verify deterministic output for identical input.
- Verify source pixels and source canvas are unchanged.
- Reject invalid dimensions and RGBA buffer lengths.
- Preserve existing tile crop and geometry behavior.

### Integration tests

- Application query parsing passes the resolved encoder into the transport.
- Baseline Canvas mode continues to call `toBlob` and satisfies its current tests.
- Indexed visible refreshes produce indexed PNG payloads.
- Original-palette refreshes force Canvas even when the URL selects indexed.
- Hidden refreshes force Canvas/original regardless of the selected encoder.
- Restore returns to indexed/hud-4.
- Byte-cache skipping compares the final encoded payload.
- Pipeline-four start behavior, no-queue busy drops, and failure semantics remain intact.
- Diagnostics contain the encoder, palette, byte totals, and duration.

### Repository verification

Run, serially:

```bash
npm test
npm run typecheck
npm run test:repo
npm run build
npm run test:sites
node --test --test-concurrency=1 tests/*.test.mjs
npm run pack
```

Also verify that the production client bundle contains no secret ORS key and that all tracked Markdown remains English.

## Physical A/B Test

Use the same charged G2 device, phone, location, data state, and interaction sequence for both URLs. Close or reload the Mini App between variants so encoder caches cannot cross the boundary.

For each variant, after one unrecorded warm-up:

1. Record five four-tile detail or restore refreshes.
2. Record five two-tile dashboard page refreshes.
3. Record five hide operations and five restores.
4. Confirm binocular display, correct tile placement, legibility, input handling, and stable hide/restore behavior.
5. Record total encoded bytes, encode duration, end-to-end refresh duration, send failures, timeouts, and dropped-busy events.

Evaluate medians separately for four-tile visible refreshes, two-tile visible refreshes, hides, and restores.

## Acceptance Criteria

The experiment passes only if all of the following hold:

- All automated verification passes.
- The G2 displays every indexed tile correctly in both eyes.
- No tile is blank, corrupt, stale, misplaced, or visibly degraded.
- No new `sendFailed`, timeout, retry, queue, or WebView-stall behavior appears.
- Indexed visible-frame payload bytes are lower than the same-frame Canvas baseline.
- Median end-to-end visible refresh or restore time improves enough to be perceptible or operationally meaningful.
- Hide remains stable on its unchanged Canvas path.

A smaller file without a physical latency improvement is useful evidence but is not sufficient for default promotion. Promotion requires a separate user decision after reviewing the complete A/B record.

## Rejection and Rollback

Reject the candidate if the G2 decoder does not accept the indexed PNG, if visual output changes, if latency regresses, or if stability worsens.

Rollback requires no code change:

```text
encoder=canvas
```

Removing the parameter also restores Canvas because Canvas remains the default. The main server on port 4177 remains the known-good physical reference throughout the experiment.

## Alternatives Considered

### Native CompressionStream

Avoids a dependency, but embedded WebView support has not been established and the asynchronous API introduces an additional experimental variable. It may be revisited separately after indexed PNG compatibility is proven.

### General-purpose PNG library

Could write indexed PNGs, but would add more code and behavior than this narrow format requires. A small local writer plus a focused zlib dependency makes chunk contents, palette order, filtering, and diagnostics directly testable.

### Uncompressed DEFLATE blocks

Would avoid a dependency but is unlikely to deliver the payload reduction being tested. It would measure palette packing without adequately measuring compressibility.

### Foreground overlay containers

Could improve tiny dynamic updates, but changes the display composition and container lifecycle. It remains a later, independent experiment after the byte-level encoder boundary is understood.

## References

- [PNG specification, W3C Recommendation](https://www.w3.org/TR/png-3/)
- [fflate official repository](https://github.com/101arrowz/fflate)
- [Compression Streams specification](https://compression.spec.whatwg.org/)
- [MDN: CompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream)
