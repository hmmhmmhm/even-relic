# G2 Balanced OSM Labels Checkpoints

Date: 2026-07-27
Branch: `feature/g2-fast-content`
SDK: `0.0.11`

## Stage 1: `map-labels-015`

Tested commit: `ed05675104a3c7f0d8a55e0623a42f1de1739d67`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-015`
Result: ITERATE

The user confirmed that the labels were present and visible, then requested
approximately 1.5 times larger text for comfortable reading:

> 라벨 잘보이고, 1.5배쯤 텍스트 크기를 키워봐야 잘보일듯합니다.

This establishes successful OSM label collection, projection, collision
layout, and physical display. It does not approve the original 9px/8px font
sizes as the final readable size.

Before this checkpoint:

- source suite: 20 files, 215 tests passed serially;
- TypeScript typecheck: exit 0;
- production build: exit 0;
- Sites suite: 4/4 passed serially;
- map API suite: 8/8 passed serially;
- live test cell: 180 roads and 24 normalized label candidates;
- HUD URL: HTTP 200.

## Stage 2: `map-labels-large-016`

Result: PENDING

The revised build uses 14px transit/place labels and 12px road/landmark
labels. Physical readability, density, bilateral output, page speed, and
double-tap restoration remain to be confirmed.
