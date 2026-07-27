# G2 Live Refresh Checkpoint

Date: 2026-07-27
Branch: `feature/g2-fast-content`
Tested implementation commit: `f49a6b04de07ec391d7451c0d36c6a3e0b27f568`
SDK: `0.0.11`
Build: `live-refresh-017`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-refresh-017`
Result: PENDING

## Implemented refresh contracts

- The clock requests only the right-top tile at the next minute boundary and
  realigns every later tick to a minute boundary.
- An official device-status event requests the right-top tile only when the
  connected G2 battery percentage or charging state actually changes.
- Official continuous location updates request a HUD location redraw after at
  least 15 metres of accepted movement.
- OSM roads and labels are requested again only after entering a new
  0.0018-degree map cell, approximately 160 to 200 metres around Seoul.
- A failed or timed-out OSM refresh retains the last visible geometry as
  `stale` instead of replacing it with an unavailable map.
- Every image update still uses the existing serialized Canvas transport.

## Automated evidence

The implementation commit passed the following commands one at a time:

- `npm test`: 21 files, 228 tests passed;
- `npm run typecheck`: exit 0;
- `npm run build`: 49 modules transformed, production build completed;
- `npm run test:sites`: 4/4 tests passed;
- map API suite: 8/8 tests passed;
- news API suite: 6/6 tests passed;
- API router suite: 2/2 tests passed;
- `git diff --check`: no whitespace errors.

These results verify scheduling, filtering, redraw targeting, cache fallback,
and transport serialization in software. They do not establish physical G2
behavior.

## Physical G2 observations

- Initial four-tile bilateral display: PENDING
- Page order and immediate scroll response: PENDING
- Clock changes at a real minute boundary: PENDING
- Battery percentage refresh after a real G2 battery change: PENDING
- Location/map response during actual movement: PENDING
- Double-tap black-frame hide and restore: PENDING
- `SENDFAILED`: PENDING

Only direct user observations from this exact build will replace these
`PENDING` entries.
