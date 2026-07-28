# G2 Hybrid Text Console Alignment Design

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

Fast page switching and clarity of native text confirmed in `/hud-hybrid-z`
While maintaining the problem of Text and Canvas frames using different coordinate systems,
Solve it.

## Confirmed cause

The Text container in SDK `0.0.10` displays `xPosition`, `yPosition`,
You can specify `width`, `height`, and `paddingLength`. After the page is opened
Only the content can be changed with `textContainerUpgrade`. Font, font size, line height,
Paragraph alignment and individual phrase coordinates cannot be specified.

In the current implementation, one full-screen text flows like a regular document starting from `(8, 8)`.
Canvas assumes absolute coordinates of multiple independent panels. Just spaces and line breaks
The inability to accurately align the two coordinate systems is the cause of alignment failure.

## Approaches reviewed

### 1. Map on the left and single text console on the right

Keep a fixed Canvas map at `180px` on the left, and a single `372px` on the right.
Use as a native text console. On the right, the interior depends on the line height.
Do not draw partitions. One text update and all existing maps
This method is adopted because it can be maintained.

### 2. Full-screen single Text console

Sorting is easiest if you simplify the entire screen into one large frame. However, if the user
The preferred large map has disappeared and the visual characteristics of the HUD have become weaker, so it is not adopted.

### 3. Multiple Text containers

By placing a separate Text container for each panel, you can maintain the existing panel coordinates.
However, since it needs to be updated multiple times per scroll, the transition is performed as soon as it is already confirmed.
It is not adopted because it may be lost or the phrases may change sequentially.

## Layout

- The entire Canvas is the same as before, `576×288`.
- The map frame on the left is `(8, 8)`, `180×272`.
- The text console frame on the right is `(196, 8)`, `372×272`.
- Layers 1–4 are the existing four image tiles.
- The Layer 5 Text container uses the same coordinates and size as the right frame.
- The text inner margin is `8px`.
- Do not draw text on Canvas.
- The right frame uses only outlines, corner marks, and short marks. Specific Text
  Do not use horizontal dividers that match the height of the row.
- The layout and transmission behavior of the existing `/hud-canvas` and `/hud-hybrid` are not changed.
  No.

## Text composition

Every page has two lines of common status, one line of space, and five lines of page information.
Compose. So a total of eight lines per page, with only one string when scrolling.
Replace it.

1. Time in seconds, weather, page number
2. `RELIC // LIVE`, location
3. Blank line
4. Page title
5–8. News, navigation, TODO or connection status

Keep each line short to avoid word wrapping within the width of the right console.
The basic page order and contents are `overview`, `navigation`, `news`, and `todo`.
Use it as is.

## Data flow

When you open the app, you draw a new Canvas background once and transfer it to the four tiles. same start
Make the right Text container on the page as layer 5. When the scroll event comes
Use the existing circular page calculations, and set the eight-line string for the new page to
Send `textContainerUpgrade` once. Send image tiles again
No.

## Error handling

If there is no Canvas 2D context or image transfer or text update fails, the existing
Use the status reporting path as is. This change requires a retry or separate recovery flow.
do not add If the text disappears again on the actual device, due to layer regression, the text
If it goes outside the frame, it is diagnosed separately using line length regression.

## Verification

- Check that the new Canvas is `576×288` and that there are no Canvas characters.
- Check whether the outer coordinates of the map and text console match the design values.
- Layer 5 Text container uses right console coordinates, size, and margins
  Confirm.
- Each of the four pages has eight lines and includes a common time, weather, and page number.
  Confirm.
- Existing text update once per scroll and no image update
  Maintain regression testing.
- Run full unit tests, type checking, production builds, and Sites output inspection.
- Final check the actual G2 alignment and binocular display at the Tailscale test address.
