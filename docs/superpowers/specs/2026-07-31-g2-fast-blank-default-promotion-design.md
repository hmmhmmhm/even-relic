# G2 Fast Blank Default Promotion Design

Date: 2026-07-31

Status: Approved

## Goal

Promote the physically validated blank-page rebuild display toggle to the
query-free production default while preserving the former black-tile toggle as
an explicit diagnostic control.

## Strategy resolution

- Missing `hide`, `hide=blank`, and unknown values resolve to
  `blank-rebuild`.
- Only the exact `hide=black` value resolves to `black-tiles`.
- The explicit black route remains fail-fast and retains its existing four-tile
  behavior for comparison and emergency rollback.
- Session and transport defaults also resolve to `blank-rebuild` so direct
  callers cannot accidentally retain the obsolete production default.

## Runtime behavior

The promoted path does not change the validated lifecycle. Hiding rebuilds the
page as one blank full-screen event-capture container without encoding or
sending an image. Restoring rebuilds the normal event layer and four image
containers, clears successful-payload state, and sends all four current tiles.
There is no queue, retry, or same-event fallback.

## Community measurement assessment

The reported device timing model attributes most image latency to a fixed cost
per `updateImageRawData` call. It reinforces the blank-page rebuild decision and
explains why payload-format changes produced only modest gains.

It does not support merging Sandevistan's current four tiles without a display
size loss. Each tile already occupies the SDK maximum image-container size of
288 by 144 pixels. The full 576 by 288 coordinate area therefore requires four
maximum-size image containers. SDK 0.0.13 exposes no independent image scaling,
fit, or source-dimension property that could stretch one 288 by 144 container
over the full display.

Consequently:

- do not repeat PNG-versus-BMP payload experiments;
- do not replace multi-container raster updates with native text updates;
- do not claim that a one-container compact HUD preserves full-screen size;
- keep unchanged-tile skipping and targeted one- or two-tile refreshes;
- treat any future one-call HUD as a deliberately smaller 288 by 144 layout,
  not a lower-resolution full-size replacement.

## Verification

Tests must prove the query-free default, explicit black override, legacy blank
alias, and direct session/transport defaults. Existing lifecycle tests must
continue proving zero image calls on blank hide and complete four-tile restore.
Documentation must describe blank rebuild as production and black tiles as the
diagnostic control.
