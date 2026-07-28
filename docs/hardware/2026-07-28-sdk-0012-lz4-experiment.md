# SDK 0.0.12 G2 LZ4 image transmission experiment

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

Date: 2026-07-28

SDK: `0.0.12`

Build: `sdk-lz4-030`

Result: `FAIL`

branch: `feature/g2-ors-routing`

Remote baseline commit: `90a9421`

Local SDK replacement commit: `588c9fc`

Local SDK recovery commit: `21c20c9`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.12&build=sdk-lz4-030`

## Purpose

Store the SDK `0.0.11` build approved on the physical G2 remotely, and only use the SDK
Change it to `0.0.12` and compare the speed and stability of LZ4 image transmission.

## Maintained transmission conditions

- Encode 576×288 Canvas into four 288×144 PNGs
- Total transmission order `3 → 5 → 2 → 4`
- Right page conversion order `3 → 5`
- Only tiles within one refresh are transmitted serially
- Prohibit simultaneous image calls
- Immediately discard busy refresh requests
- Prohibit failed update retries and overdue event processing
- Maintain 12 second time limit per tile

## Identified SDK differences

The app's `ImageRawDataUpdate` call argument was not changed. SDK `0.0.12`
`compressMode: 2` is automatically added to the `toJson()` result, and this can be done as a unit test.
The contract was fixed. The Canvas renderer and transmission scheduler sources were not changed.

## Automatic verification

- SDK version, app minimum version, QR mark test: 2/2 passed
- `npm test`: 37 files, 371 tests passed
- `npm run test:sites`: 4 tests passed
- `npm run typecheck`: Passed
- `npm run build`: Converted 67 modules, passed production build.
- Check installation: `@evenrealities/even_hub_sdk@0.0.12`
- Check payload: `compressMode: 2`
- Tailscale experiment URL: HTTP 200

The above commands were not executed simultaneously but were executed sequentially in one process.

## Actual G2 results

On the first run, Canvas four-tile encoding was completed normally in 55ms, but the first
The `relicTR` transmission returned `sendFailed` in 7ms. The remaining three tiles are
There was no transmission and no screen was displayed on both eyes.

```text
[15:35:46.275] [ENCODE] start · 4 tiles
[15:35:46.330] [ENCODE] complete · 4 tiles · 55ms
[15:35:46.330] [TILE] relicTR start · 1/4
[15:35:46.337] [ERROR] relicTR failed · sendFailed · 7ms
[15:35:46.338] [ERROR] app startup failed · Error
```

The transmission scheduler and Canvas source have not changed from the `0.0.11` baseline. execution
The only difference in payload is `compressMode: 2`, which was automatically added by SDK `0.0.12`.
It is an immediate failure earlier than the BLE transmission time and is similar to the past `0.0.12` physical failure.
Since they are the same, it appears that the current Even app image bridge does not accommodate LZ4 mode.
Judge.

## Actual G2 serial confirmation sequence

- [x] The first tile failure time of the first run is left in the diagnostic log.
- [ ] In the first run, four tiles and binocular display are completed. (`sendFailed`)
- [ ] General page next/previous movement moves only one page at a time.
- [ ] The update times for the two tiles on the right remain in the diagnostic log.
- [ ] Overview, News, TODO, Weather details entry and return are activated.
- [ ] Map zoom, news body page, and TODO check/uncheck work.
- [ ] HUD hiding and restoration works.
- [ ] Additional input during transmission ends with `dropped · busy` and is not re-executed later.
- [ ] `SENDFAILED` does not occur.
- [ ] WebView does not stop when left still.

## Judgment

Subsequent behavioral tests were discontinued due to failure at the initial display gate. SDK
The `0.0.12` experimental commit is not pushed remotely. The app runs with SDK `0.0.11` and the new
Recover with cache marker and check again at the following URL.

`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=sdk-lz4-fallback-031`
