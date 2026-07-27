# G2 Fullscreen Map Checkpoint

Date: 2026-07-27
Branch: `feature/g2-fast-content`
Tested implementation commit: `9759d7b9368ce5f6c49ed0acf9f160ae3ee10860`
SDK: `0.0.11`
Build: `fullscreen-map-018`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fullscreen-map-018`
Result: PENDING

## Implemented interaction contracts

- A single tap enters the fullscreen map only from the overview.
- The fullscreen map uses all four image tiles and both display halves.
- Scroll bottom zooms in and scroll top zooms out through
  850m, 650m, 500m, 375m, and 280m radii.
- A boundary scroll is consumed without a transfer or page change.
- The selected zoom remains active in both embedded and fullscreen maps and
  does not reset on live movement.
- A fullscreen double tap returns to the overview.
- A dashboard double tap retains black-frame hide and restore.
- All interaction, paging, hiding, and live refresh sends share the existing
  serialized Canvas transport queue.

## Automated evidence

The implementation commit passed these commands one at a time:

- `npm test`: 22 files, 240 tests passed;
- `npm run typecheck`: exit 0;
- `npm run build`: 50 modules transformed, production build completed;
- `npm run test:sites`: 4/4 tests passed;
- API router suite: 2/2 tests passed;
- map API suite: 8/8 tests passed;
- news API suite: 6/6 tests passed;
- `git diff --check`: no whitespace errors.

These results verify state transitions, projection, collision layout, Canvas
rendering, input routing, refresh targeting, and transport serialization in
software. They do not establish physical G2 behavior.

## Physical G2 observations

- Single-tap overview entry: PENDING
- Map output across both eyes and all four quadrants: PENDING
- Bottom-scroll zoom in: PENDING
- Top-scroll zoom out: PENDING
- Zoom retention after dashboard return: PENDING
- Zoom retention after movement: PENDING
- Zoom-limit scroll does not navigate: PENDING
- Fullscreen double-tap overview return: PENDING
- Dashboard double-tap black hide and restore: PENDING
- Normal four-page dashboard scrolling: PENDING
- `SENDFAILED`: PENDING

Only direct observations from this exact build will replace these `PENDING`
entries.
