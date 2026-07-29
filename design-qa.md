# Sandevistan Phone Companion Design QA

- source visual truth: user-provided Even app Home, Dashboard, and Menu screenshots
- implementation route: `/hud-canvas-fast?sdk=0.0.11`
- intended viewport: narrow phone WebView, up to 540 CSS px wide
- implementation screenshot: unavailable in this session
- state: native `SANDEVISTAN` title, Home beginning at the live HUD preview,
  eight-card dashboard, and text-breadcrumb detail navigation
- primary interactions tested: every card opens its detail directly, the
  `Dashboard / Detail` breadcrumb returns Home, and the Canvas DOM node remains
  mounted
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
Developer. Storage and provider failures are represented as recoverable inline
states, and deleting a local ORS key is not blocked by an unavailable live
route session. Component tests now cover every editable HUD ordering action,
the complete phone TODO lifecycle, successful and failed key persistence,
active-route cache deletion, detailed weather values, and available/unavailable
device states.

Static visual-contract tests additionally lock the approved neutral tokens,
two-column `1.28 / 1` card geometry, 8 px gap and radius, shadow-free cards,
320 px two-column behavior, neutral HUD-preview filter, the absence of a
redundant Home eyebrow, a full-width text breadcrumb, and 44 px minimum targets.
These checks prevent token regressions but do not replace the required rendered
screenshot comparison.

## Visual comparison blocker

The owner supplied current Home and HUD-layout screenshots on 2026-07-29. They
showed the exact hierarchy defects addressed here: `SANDEVISTAN HUD Prototype`
in the native bar, a redundant `SANDEVISTAN / DASHBOARD` Home eyebrow, and a
second arrow beside the HUD-layout title. The implementation could not be
captured after the change at the same viewport because the approved in-app
browser runtime is unavailable in this session. There is therefore no approved
post-change capture to pair with those screenshots. A same-state side-by-side
comparison remains pending, while the Tailscale preview remains available for
physical phone inspection.

## Comparison history

1. Matched the white/gray token set and removed dark HUD styling from phone UI.
2. Replaced the intermediate management page with eight full-card destinations.
3. Replaced generic symbols with local Pixelarticons.
4. Corrected the cards to the measured `1.28 / 1` shape, 8 px gap/radius, and
   wider reference-like internal padding.
5. Removed the WebView Home project eyebrow so the live preview is the first
   app-owned element.
6. Changed the document title from `SANDEVISTAN HUD Prototype` to
   `SANDEVISTAN`.
7. Replaced the internal detail Back arrow with a localized, full-width
   `Dashboard / Detail` breadcrumb that returns Home without remounting Canvas.

## Remaining visual gate

- Capture the Home screen at a fixed phone viewport.
- Combine that screenshot with the supplied Even Home reference.
- Check card proportions, HUD-preview density, icon placement, typography,
  native/WebView hierarchy, breadcrumb spacing, footer spacing, and any clipped
  Korean copy.
- Repeat for one detail screen and record `final result: passed` after visible
  mismatches are corrected.

final result: blocked
