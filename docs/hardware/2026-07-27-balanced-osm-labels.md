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

Tested commit: `8d3eb6f2cc58860bd5f6e26db6f47d7e1dd526c2`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-large-016`
Result: PASS

The revised build uses 14px transit/place labels and 12px road/landmark
labels. The user confirmed that the revised physical label size was
satisfactory:

> 이제 라벨사이즈는 흡족하네요

This is direct physical evidence that the enlarged labels remained visible
and reached the desired readability. Bilateral output, page speed, and
double-tap restoration were not re-observed in this exact response; their
previously verified transport behavior was unchanged by this font-only
revision.
