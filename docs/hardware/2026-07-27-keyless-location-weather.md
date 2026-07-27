# G2 Keyless Location and Weather Success

Date: 2026-07-27
Branch: `feature/g2-fast-content`
Tested commit: `1da29615713c6e3f730ad0c61341d7dbe0e88435`
SDK: `0.0.11`
Build: `live-weather-012`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-weather-012`
Path: `/hud-canvas-fast?sdk=0.0.11&build=live-weather-012`
Result: PASS

## Physical G2 confirmation

The checkpoint asked the user to verify the initial HUD, bilateral four-tile
output, location source or fallback display, visible live weather replacement
in the right panel, normal page scrolling, and double-tap hide/restore. The
user confirmed the checklist as a whole:

> 네 다 잘 동작합니다.

Recorded results:

- Initial HUD display: PASS
- Bilateral four-tile output: PASS
- Location source or fallback display: PASS
- Live Open-Meteo weather replacement: PASS
- Normal page scrolling: PASS
- Double-tap black-frame hide and restore: PASS

The exact location label (`LIVE`, `LAST FIX`, or `DEMO`) and numeric weather
values were not transcribed, so this record does not infer them. No image
transfer trace was shown during this checkpoint. Exact `3/5` refresh targeting,
hidden-state refresh suppression, and restoration of a value changed while
hidden therefore remain automated transport evidence rather than separate
physical observations.

## Truthful pre-OSM scope

This checkpoint covers keyless Even Hub location and Open-Meteo weather only.
The G2 header deliberately identifies the location source while keeping the map
as `MAP DEMO`, and the phone WebView credit reads:

```text
날씨: Open-Meteo · 지도: 데모 스키매틱
```

The schematic is not presented as live OpenStreetMap data. OSM fetching,
projection, attribution, and its physical checkpoint remain deferred to the
dedicated OSM implementation plan.

## Automated evidence

The tested build and its documentation/QR update were checked with:

- `npm test`: 15 files, 184 tests passed;
- `npm run typecheck`: exit 0;
- `npm run build`: exit 0;
- `npm run test:sites`: 4/4 tests passed;
- `git diff --check`: no whitespace errors.

The automated transport suite verifies that weather-only refreshes target IDs
`3/5`, hidden refreshes do not transmit, and restore sends the newest complete
frame. Those internal conditions were not separately instrumented in the
physical checkpoint above.

## Active QR identity

`npm run qr` now points to the exact approved Tailscale URL and build tag shown
above. The SDK remains pinned to the hardware-approved pre-LZ4 `0.0.11`
transport baseline.
