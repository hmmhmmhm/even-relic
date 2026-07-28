# G2 Fast Canvas date and display toggle design

## Target

Approved split layout, content order, 2-tile scrolling in `/hud-canvas-fast`
While maintaining transmission, we add the following two functions:

1. Display the year, month, day, and day of the week in the clock header.
2. Double tap G2 or R1 to hide and restore only the display pixel without exiting the app.
3. Only the WebView preview is displayed in green like the surrounding text and a luminous effect is applied.
   Remove.

## Date and time

The time maintains the existing `HH:MM` format. underneath it
Displays the date in the format `YYYY.MM.DD day of the week`.

```text
14:37
2026.07.27 Monday
```

The date and time are updated when the Canvas is redrawn by starting the app or scrolling the page.
Does not automatically retransmit images every minute or second. The existing weather and page number are
Keep it on the right so that it does not overlap with the date within the same header.

## SDK Constraints

SDK `0.0.10` includes a release that only suspends the display while leaving the app running.
There is no API. `shutDownPageContainer()` provides only two shutdown operations:

- `exitMode 0`: Immediate exit
- `exitMode 1`: Front panel display asking whether to exit

Therefore, the method of restoring with a double tap event of the same app after calling the exit API is
cannot be used

## Reviewed display-hiding methods

### 1. Shutdown API

As with the current implementation, call `shutDownPageContainer(1)` on double tap. Close app
A confirmation panel will appear and you will not be able to restore the HUD with the same double tap, so
It doesn't fit.

### 2. Reorganized with blank event page

Remove the image container with `rebuildPageContainer()` and only the event layer
After leaving, the image container is recreated during restoration and the four tiles are retransmitted.
You can hide the display, but it adds container reconfiguration and risks restore failure and flickering.
Do not use it because it is large.

### 3. Transfer of black image tiles

Maintain the existing image container and transparent event capture Text layer. first
In the double tap, the black canvas is encoded into four tiles and serially assigned to IDs `2, 3, 4, 5`.
Send. The second double tap re-encodes the current HUD Canvas into four tiles.
Serially transmit to the same ID.

You can continue receiving events without reconfiguring the container, and display pixels.
This method is adopted because everything can be turned off. This is the display
This is a pixel hiding and is not an official low power mode for the device or app.

## Input and status

Whether the `eventSource` of the double tap is the right temple, the left temple, or R1, and
Executes the same toggle regardless.

### Showing

- Scrolling down and up moves to the next and previous pages as before.
- Double tap adds a hidden task to the visible toggle queue.
- After the transmission of the four black tiles is completed, change the status to `hidden`.

### Hiding

- Down and up scrolling is ignored.
- Double tap adds a restore operation to the display toggle queue.
- After sending the four HUD tiles of the current page, change the status to ‘visible’.

The target for restoration is the page you were viewing just before hiding. While hiding, the page index
don't change

## Serialization and error handling

Scroll and display toggles share a single serial task queue. Transferring images to other
Even if input comes, the two transmissions do not overlap.

- If hidden transmission fails, the state remains `visible`.
- If restoration transmission fails, the state remains `hidden`.
- Failure messages are displayed in the existing progress status output.
- After failure, you can try the same task again with the next double tap.
- The double tap exit behavior of paths other than fast Canvas does not change.

## Transfer Agreement

- First display: ID `2, 3, 4, 5`
- Scroll page while displaying: ID `3, 5`
- Hidden: Black image ID `2, 3, 4, 5`
- Restore: Current HUD image ID `2, 3, 4, 5`
- Scroll while hidden: no image transfer

## WebView Preview

Canvas palette for sending glasses `#ffffff`, `#d0d0d0`, `#808080`,
`#000000` does not change. If you change the Canvas pixel itself to green, the PNG
Since the encoding result also changes, preview colors are handled only by CSS.

The methods reviewed are as follows.

1. The method of redrawing the Canvas pixels to green even includes the glasses transmission data.
   Do not use it because it will change.
2. CSS `filter` combinations can approximate the green color you want with white, but it may vary depending on the brightness.
   Do not use it as colors and browser differences may occur.
3. Place the `#91ff73` layer on the WebView Canvas and mix it with `multiply`.
   White is `#91ff73`, the same as the surrounding basic text, gray is a low brightness of the same color,
   Black looks black. Only DOM/CSS composition changes, so transfer PNGs are not affected.
   do not give

Adopt the third method. `box-shadow` in `.hud-frame` and page background
This removes the radial gradient, which also eliminates the glowing effect around the preview. border and
Keep the green text.

## Test

- Check whether the date is drawn in the format ‘YYYY.MM.DD day of the week’.
- Check that the date, weather, and page number do not exceed the header boundary.
- Check that fast Canvas double tap does not call the exit API.
- Make sure the first double tap transfers the four black tiles in order.
- Check that scrolling while hiding does not execute page callbacks or image transfers.
- Verify that the second double tap restores the current HUD four tiles in order.
- Check that image transmission is performed one at a time even with continuous input.
- If hiding/restoration fails, check whether the state is not switched incorrectly and can be retried.
- Double tap exit action of existing `/hud-canvas` and scroll ID `3, 5` of fast Canvas
  Verify that the contract is maintained.
- The WebView preview composite color is `#91ff73` and the shadow and radial gradient are
  Check if there are any.
- The image encoding result for Canvas internal palette and glasses transmission is based on the existing brightness value.
  Make sure it is maintained.

## Check hardware

Check the following in the actual G2 and R1.

- Double-tapping the glasses changes the HUD to a black screen.
- The same action can be performed by double tapping R1.
- In a black state, other apps and system screens can be used normally.
- If you double-tap again, the page before hiding will be restored.
- Scrolling while hiding does not turn the screen back on.
- After restoration, the page scroll speed is the same as the existing baseline.
