# RELIC HUD Design QA

- source visual truth path: `docs/design/selected-peripheral-focus.png`
- implementation screenshot path: unavailable
- intended viewport: 576 x 288 CSS px
- source pixels: 1792 x 896
- implementation pixels: unavailable
- density normalization: source and implementation were not normalized because browser capture was unavailable
- state: selected Peripheral Focus source rasterized to a 576 x 288 Canvas
- primary interactions tested: four-tile transport sequencing and double-tap exit wiring
- console errors checked: blocked because no browser backend is available

## Full-view comparison evidence

The exact source image is now loaded into the implementation Canvas and scaled
to the G2 resolution. The implementation could not be captured because the
in-app browser runtime reported no available browser backends.

## Focused region comparison evidence

Blocked for the same reason. No implementation screenshot exists for a same-state comparison.

## Findings

- [P0] Browser and physical-glasses evidence is unavailable
  - Location: full 576 x 288 HUD.
  - Evidence: the implementation draws the source raster directly, but the browser runtime returned an empty browser list and the G2 optical output has not yet been reported.
  - Impact: SDK 4-bit conversion, physical contrast, text legibility and peripheral placement cannot be approved from code alone.
  - Fix: inspect the QR-sideloaded frame on the G2 and report which regions are too small, dim or distracting.

## Comparison history

No visual comparison iteration has run. Unit rendering tests and TypeScript checks are not substitutes for browser evidence.

## Required fidelity surfaces

- Fonts and typography: fixed in the selected raster; physical legibility pending.
- Spacing and layout rhythm: fixed in the selected raster; optical placement pending.
- Colors and visual tokens: SDK 4-bit conversion pending physical confirmation.
- Image quality and asset fidelity: direct source downscale is implemented; G2 conversion quality pending.
- Copy and content: fixed in the selected raster.

## Implementation checklist

- View the four-tile frame on the real G2.
- Record legibility for the top compass, minimap, telemetry and bottom labels.
- Adjust density or contrast based on physical evidence.
- Capture the browser preview when an approved browser backend is available.

final result: blocked
