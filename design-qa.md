# Sandevistan Phone Companion Design QA

- source visual truth: user-provided Even app Home, Dashboard, and Menu screenshots
- implementation route: `/hud-canvas-fast?sdk=0.0.11`
- intended viewport: narrow phone WebView, up to 540 CSS px wide
- implementation screenshot: unavailable in this session
- state: compact WebView section header, live HUD preview, and eight-card phone
  companion Home
- primary interactions tested: every card opens its detail directly, Back returns
  to Home, and the Canvas DOM node remains mounted
- browser console inspection: blocked because the in-app browser runtime exposed
  no browser backend

## Source-matched geometry

The implementation uses the dimensions measured from the supplied Even Home:

- `#eeeeee` page background and white cards;
- two equal columns with an 8 px gap;
- card aspect ratio `1.28 / 1`;
- 8 px card radius with no shadow or glow;
- responsive 24–36 px internal padding;
- monochrome Pixelarticons at the upper left;
- title and compact live status at the lower left;
- a washed grayscale Canvas preview on a neutral gray panel.

## Functional comparison evidence

React interaction tests open Devices, HUD layout, News, TODO, Weather,
Navigation, Language, and Developer directly from their cards. The tests also
verify that there is no `Manage` destination and that opening and closing a
detail screen does not remount the G2 Canvas.

The details provide real editable states for HUD ordering, RSS sources, TODOs,
device-local ORS key validation, and language. Diagnostics appear only under
Developer.

## Visual comparison blocker

The supplied reference was available, but the implementation could not be
captured at the same viewport because the approved in-app browser runtime
returned an empty browser list. A same-state side-by-side screenshot comparison
therefore remains pending. The Tailscale preview is running for physical phone
inspection.

## Comparison history

1. Matched the white/gray token set and removed dark HUD styling from phone UI.
2. Replaced the intermediate management page with eight full-card destinations.
3. Replaced generic symbols with local Pixelarticons.
4. Corrected the cards to the measured `1.28 / 1` shape, 8 px gap/radius, and
   wider reference-like internal padding.
5. Demoted the WebView title bar to a 40 px inset section label and reduced
   detail headers to a 52 px transparent, left-aligned navigation row so they
   do not compete with the native Even app bar.

## Remaining visual gate

- Capture the Home screen at a fixed phone viewport.
- Combine that screenshot with the supplied Even Home reference.
- Check card proportions, HUD-preview density, icon placement, typography,
  subheader hierarchy, footer spacing, and any clipped Korean copy.
- Repeat for one detail screen and record `final result: passed` after visible
  mismatches are corrected.

final result: blocked
