# SDK 0.0.11 G2 Transport Success

Date: 2026-07-27
SDK: `0.0.11`
Build: `fast-right-first-011`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fast-right-first-011`
Path: `/hud-canvas-fast?sdk=0.0.11&build=fast-right-first-011`
Result: PASS

## Physical G2 checklist

- Bilateral display: PASS
- All four quadrants of the `576 x 288` frame render: PASS
- Page scrolling keeps the existing 1→2→3→4 direction: PASS
- Full transfer visibly loads right-top, right-bottom, left-top, left-bottom
  (`3/5/2/4`): PASS
- Double-tap black hide and restore: PASS
- `SENDFAILED`: not observed

## Automated evidence

The gate build at commit `df19655a40dc72a088fb702c8d3e1cade7e0274d`
also passed:

- source tests: 53/53;
- TypeScript typecheck;
- production build;
- Sites tests: 4/4.

## Approved transport contracts

- Fast full transfer: `3/5/2/4`
- Fast scroll transfer: `3/5`
- Legacy full transfer: `2/3/4/5`

SDK `0.0.11` is the live-data baseline. SDK `0.0.12` remains blocked until
separately proven on the physical G2.
