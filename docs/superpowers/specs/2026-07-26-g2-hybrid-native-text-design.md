# G2 Hybrid Native Text HUD Design

## Target

Fixed an issue where page transitions in the existing 4-tile Canvas HUD were slow and appeared in four pieces.
Reduce it to a separate, verifiable path. The background graphic is an image only once.
Transfer, and subsequent page transitions are performed using only one full-screen native text container.
Update.

The verified 4-tile path of the existing `/hud-canvas` and SDK `0.0.10` will not be changed.
The new experimental path is `/hud-hybrid`.

## Page composition

On the start page, create the same five containers as before.

- ID 1 `eventLayer`: 576×288 Text, transparent background, event capture, dynamic page text
- ID 2–5: Four 288×144 images, common tactical background without text

The Text container is created with a single space character at startup. All four images were sent.
Upload the first `OVERVIEW` phrase to ID 1 with `textContainerUpgrade()`. this
The order is the last text update in SDK `0.0.10` without explicit z-order.
It is an actual device A/B to check whether it is visible on the image.

## Common Canvas background

`drawHybridHudBackground()` draws only the following static elements on a 576×288 Canvas.

- Black background and white/gray tactical frame
- 64 pixel header separator line
- Left area map roads and routes
- Common divider and corner decoration in right information area

Not a single letter is drawn on Canvas. News, time, weather, navigation,
All information that changes, such as to-dos and page numbers, is native text content.

## Native page text

`formatHybridHudText(page, now)` returns a single string including spaces and line breaks.
make it The page order is the same as before.

1. `OVERVIEW`: Current time, Hongdae weather, local news and brief status
2. `NAVIGATION`: Destination, distance, right turn and next intersection
3. `NEWS`: Big local headlines and weather briefings
4. `TODO`: To-do check status and G2/R1 connection status

Each content includes page numbers from `01/04` to `04/04`. korean,
Verify that the arrows and check marks actually appear in the G2 built-in font. Canvas and
The size, font, and pixel coordinates for each letter are not required.

## Transmission and Input

Initial entry serially transmits image IDs 2, 3, 4, and 5 as before. since
Scrolling does not encode images or call `updateImageRawData()`.

- `SCROLL_BOTTOM_EVENT`: Update next page text once
- `SCROLL_TOP_EVENT`: Update previous page text once
- `DOUBLE_CLICK_EVENT`: Existing shutdown behavior

Fast consecutive inputs are processed in order in a single Promise queue.
If `textContainerUpgrade()` returns `false`, mark an error as progress and
Absorbs queue errors so that the next input can continue to be received.

## Judgment criteria

Automated testing fixes:

- The common background Canvas is 576×288 and does not call `fillText()`.
- Four page copy includes page number and unique content.
- Image IDs 2–5 are transmitted once only on initial entry.
- The initial text update is called once after four images.
- Down and up scrolling only updates the text once each without additional image transfer.
- Even in continuous scrolling, the maximum number of simultaneous executions of text updates is 1.
- Only `/hud-hybrid` selects the hybrid renderer, while the existing `/hud-canvas` selects the hybrid renderer.
  don't change

In actual G2, check the following.

- Text is displayed on top of the image and does not cover the background.
- Hangul, `→`, `[ ]`, and `[x]` are read.
- When scrolling down or up, the entire text changes at once.
- The conversion speed is definitely faster than the existing four image updates.
- Both eyes switch to the same phrase at the same time.

If the overlap order or font display fails, leave `/hud-hybrid` as the diagnostic path only.
Keep the existing `/hud-canvas` as the default candidate.

## Actual device URL

The build identifier is `hybrid-text-005`.

```text
http://100.96.68.73:4173/hud-hybrid?sdk=0.0.10&build=hybrid-text-005
```
