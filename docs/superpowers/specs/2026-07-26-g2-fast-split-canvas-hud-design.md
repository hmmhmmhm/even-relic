# G2 Quick Split Canvas HUD Design

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

While preserving the existing multi-section `/hud-canvas`, separate
Control the font size, thickness, brightness, and precise placement of the Canvas in `/hud-canvas-fast`.
Recover and reduce the amount of scroll image transmission from four to two.

## Preservation criteria

- The rendering and four tile transfer of `/hud-canvas` are not modified.
- `/hud-hybrid` and `/hud-hybrid-z` are also maintained for comparison experiments.
- New renderer and transport selection are only used in `/hud-canvas-fast`.
- You can always view the existing screen with the Git baseline `325eab1` and subsequent Canvas HUD history.
  You can check again.

## Identified performance causes

Currently `refreshImages()` in `transmitCanvas()` works on start send and scroll send.
All four identical tiles are encoded as PNG and transmitted serially in the order ‘2, 3, 4, 5’.
Since the entire Canvas is redrawn when changing pages, even the map on the left is redrawn every time.
It is retransmitted.

In SDK `0.0.10`, the existing four image containers are maintained while the specific container is
Only images can be updated. So the left half that doesn't change between pages is
Send only once for the first time, and when scrolling only the container `3, 5` in the dynamic right half
It can be renewed.

## Approaches reviewed

### 1. Update the fixed map on the left and the two tiles on the right

Canvas reduces scroll image transfer by half while maintaining full design control
Reduce. The map on the left should be exactly the same on all pages, but if the user
We adopt this method because we can maintain the preferred large map.

### 2. Update Canvas for all four tiles

You can freely change the entire screen for each page, but it has already been confirmed to be slow.
Same as existing transmission. The existing `/hud-canvas` continues to serve as the basis for this comparison.

### 3. Mixing Canvas and native text

The conversion is the fastest, but the SDK does not have font size, thickness, and font brightness properties, so this time
It does not meet the game HUD expression, which is the core of the experiment. The existing hybrid route
This serves as the standard for comparison.

## Screen composition

The entire screen is 576×288, the same as before.

- Left `0–287px`: Fixed map area unrelated to the page.
- Right `288–575px`: Information area that changes depending on the page
- On the left is a `272×272` map frame, road network, current route in bold, and destination marker.
  Place it.
- On the right, there are three sections: common status header, large core information, and short auxiliary information.
  Place it.
- The time is displayed in seconds and the weather and page number are placed in the same header.
- Core information is drawn in the `20–28px` range, and auxiliary information is drawn in the `10–16px` range.
- Bright information is `#ffffff`, auxiliary information is `#d0d0d0`, structural lines are `#808080`,
  For the background, use `#000000`.
- Bold paths, arrows, checkboxes, and corner markers add depth and depth to your game HUD.
  Create direction.

## Page

The page order is the same as before: `overview`, `navigation`, `news`, and `todo`.

- `overview`: Traffic conditions, congestion, weather and current TODO
- `navigation`: `120m`, big right turn arrow, guidance to next intersection
- `news`: Big traffic headlines, Hongik University Station status, weather briefing
- `todo`: two incomplete items, completed items, G2 and R1 connection status

The left map pixel is the same on all four pages. All page differences are on the right
It only happens in half of the cases.

## Transmission flow

When starting the app, it creates four image containers as before and sends all four tiles.
When a scroll event comes, it uses the existing circular page calculation and serial queue to get the next
Draw the page on Canvas. Then, top right `relicTR` and bottom right
Only `relicBR` is encoded and transmitted to containers `3, 5` in order.

Optimization of the fast path only specifies a different list of update tiles during navigation.
`/hud-canvas` continues to use the default of four tiles.

## Error handling

If any of the four tiles fail at startup, the existing error is reported as is.
If one of the two tiles on the right fails when scrolling, the corresponding container name and failure
Displays results and clears existing error paths so that the next navigation request in the queue can be executed.
maintain Automatic retry or left tile replacement transmission are not included in this scope.

## Verification

- The existing `/hud-canvas` rendering test must pass without changing a single pixel contract.
  Do it.
- The new renderer must use `576×288` and a high brightness four-level palette.
- The `288×288` rendering command on the left side of all four pages must be the same.
- The new page contains key characters of `20px` or more, time in seconds, weather, and page size.
  Must include number.
- When starting, the image ID is only `2, 3, 4, 5`, and when scrolling down and up, it is only `3 and 5` respectively.
  must be transmitted.
- Even with continuous scrolling, image transfers must be serialized one at a time.
- Run full unit tests, type checks, production builds, and sites checks.
- Is it actually faster than the existing four tile transition on the G2?
  Make sure it looks like a transition.
