# G2 page type HUD design

## Target

While maintaining the large text, clarity, and 4-tile transmission path of the current 576×288 tactical HUD.
Information is distributed over four pages. The default screen is non-navigational and is centered
The route guidance and bottom intersection card are changed to news. Users have a G2 or R1
Scroll to cycle back and forth through the page.

## Page order

The pages cycle circularly in the following order.

1. `OVERVIEW` (`01 / 04`): Map, news headlines/summaries, microphone, simple tasks
2. `NAVIGATION` (`02 / 04`): Map, 120m right turn guidance, next intersection, microphone,
   simple to do
3. `NEWS` (`03 / 04`): Big news headlines and regional/weather briefings
4. `TODO` (`04 / 04`): Large checklist and audio/connection status

When you first open or refresh the app, it always draws an `OVERVIEW`.
At the top center of `OVERVIEW`, `NEWS // LOCAL 01`, `Line 2 operating normally`,
‘Hongik University Station Congestion Level’ is displayed as ‘average’. At the bottom center
Displays `BRIEF // 02`, `today 23°C · clear`, `precipitation 10%`.
`NAV // ROUTE 01`, `next intersection`, and `right turn` are not displayed in `OVERVIEW`.

The `NEWS` page rearranges the headlines into larger cards, and the `TODO` page
‘Go to the subway station’, ‘Bring an umbrella’, and ‘Confirm route’ with large checkboxes.
Display. The data is a static mockup identical to the existing prototype. external news,
Weather and map API connections are not included in the scope.

## Input and status

- `SCROLL_BOTTOM_EVENT`: Next page
- `SCROLL_TOP_EVENT`: Previous page
- `DOUBLE_CLICK_EVENT`: Close the app as before

The R1 touchpad also uses the same scroll event as the G2, so there is no separate ring branch.
No. When you move from the last page to the first page, from the first page
Moving back takes you to the last page.

## Transmission stability

On initial entry only, it creates an empty event capture layer and four image containers.
The page container is not reorganized during scroll transitions. Next on the same Canvas
After redrawing the page, only the image data for existing container IDs 2–5 is updated.
This means that the temporary monocular display observed in the previous actual device is accompanied by page reconstruction.
Reduces the likelihood of recurrence.

Each transition is processed in one queue in the following order.

1. Change the page index to circular.
2. Redraw the same 576×288 Canvas.
3. Encode your PNG tiles.
4. Send one page at a time in the following order: ID 2, 3, 4, and 5.

Additional scrolls in progress are not discarded but placed behind the queue. Therefore, the BLE image
Updates do not overlap each other and input order is preserved. Conversion failure progresses
It absorbs errors in the queue so that it can mark the message and receive the next input.

## Visual rules

- Canvas size and tile border are fixed to four sheets of 576×288, 288×144.
- Maintain the existing four-color palette of black, white, medium gray, and dark gray.
- The clock displays `HH:MM:SS` at the time of page redraw.
- The current page number is displayed in `01 / 04` format on the right side of the common header.
- Maintain tactical frames, angled paths, monospaced fonts, and large key numbers and sentences.
- User-approved alternative to the initial concept of completely clearing the central reality field of view.
  Prioritize high-density dashboard configuration.

## Automatic verification

- The default call is `OVERVIEW` news content and navigation by drawing `01 / 04`
  Make sure you are not drawing text.
- `NAVIGATION`, `NEWS`, and `TODO` are unique phrases and correct pages for each page.
  Make sure you draw the numbers.
- Check that all pages adhere to 576×288 and the existing 4-color palette.
- After scrolling below, the same four image containers are updated once more in order.
  Verify that page reorganization does not occur.
- Check whether down and up scrolling is transmitted to `next` and `previous` respectively.
- Check that the maximum number of simultaneous executions of image transmission is 1 even in continuous input.
- One-time reconfiguration operation when existing double click ends and initial page creation fails.
  Make sure it is maintained.

## Check actual device

The build identifier is `paged-hud-004`.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=paged-hud-004
```

After refreshing on G2, binocular display, basic news screen, down/up scroll cycle,
R1 scroll cycle, check whether partial screen is completed normally during four tile update
Check them one by one.
