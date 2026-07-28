# G2 map empty state, news body page, TODO re-toggle checkpoint

Date: 2026-07-28

SDK: `0.0.11`

Build: `page-direction-027`

Result: `SUPERSEDED`

branch: `feature/g2-ors-routing`

Implementation commit: `e4a0257`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=page-direction-027`

This checkpoint verifies weather details and dynamic navigation pages together.
Replaced by checkpoint `weather-pages-028`.

## Implementation scope

- If there are no GPS coordinates, a sample map is not drawn in the map area and ‘NO GPS DATA’ is displayed.
- If there are actual GPS coordinates but no map data, ‘NO DATA’ is displayed in the map area.
- Removed jagged sample grid lines on temporary maps.
- If there is no valid direction information, the current location is displayed as a hollow circle.
- Show current location arrow only when there is valid direction information
- Divide the detailed news text into 21px and the actual Canvas width and display four lines on one screen.
- News next scroll shows the remaining text pages first and then moves to the next article
- Scrolling before news shows the previous body page first, and at the border of the article, the previous page is displayed first.
  Go to the last body page of the article
- Display article number and current body page in news detail header
- If you tap a checked TODO again, it will be unchecked and the screen will be redrawn immediately.
- TODO input whose change is rejected is completed without sending the screen
- Restore the normal 4-page scroll direction to the previously used direction.
- Only scrolling consumed by map details is processed as zoom inversion and separated from general page transitions.

This checkpoint includes 100 news libraries from the previous `news-library-025`, 1 hour
Refill, suppress refill while reading, limit tile transfer to 12 seconds, request non-accumulation and page
Rollback is also included.

## Automatic verification

The commands below were executed in order rather than simultaneously.

- `npm test`: 35 files, 341 tests passed
- `node --test --test-concurrency=1 tests/*.test.mjs`: Passed 28 tests
- `npm run typecheck`: Passed
- `npm run build`: Converted 65 modules, passed production build.
- Tailscale HUD URL: HTTP 200

Automatic tests include map data prioritization, sample grid removal, circle and arrow marker branching,
News text, two-way page movement, border processing, TODO check/uncheck and redrawing
Verify. Normal page transitions and detailed map zoom use different orientation rules.
It is also verified that input consumed in details is not lost through general page conversion.
Actual glasses display and SDK input/transmission are checked using the physical checkpoints below.

## Actual G2 Check Items

- [ ] All four 576×288 tiles are displayed normally in both eyes.
- [ ] The general 4-page scroll direction is the same as the direction used before the map zoom was reversed.
- [ ] Only the map detail zoom direction is reversed and does not affect the general page direction.
- [ ] When GPS is not available, only ‘NO GPS DATA’ is clearly visible in the map area.
- [ ] When there is GPS but no map data, only ‘NO DATA’ is displayed in the map area.
- [ ] When there is map data, only actual roads and labels are shown without a sample grid.
- [ ] When there is no direction information, the current location appears as a hollow circle.
- [ ] When direction information is available, the current location changes to an arrow.
- [ ] The news text is slightly smaller than the title and uses ample left and right width.
- [ ] When scrolling through long news, the remaining text continues first instead of the next article.
- [ ] If you scroll in the opposite direction from the first body of a long news, you will see the last article of the previous article.
  Go to main text.
- [ ] The news article/body page counter matches the current content.
- [ ] If you tap the checked TODO again, it will be unchecked and immediately reflected on the screen.
- [ ] Map zoom, news movement, TODO input, and dashboard return even after transmission failure
  Continues operation on the next independent input.
- [ ] Even if it is turned on for a long time, update requests or location events do not accumulate.

## Gate

Remote push and completion notification will not be processed until the actual G2 items above are confirmed.
After receiving direct observation results, update `Result` and check items in this document.
