# G2 Maximum Display-Area Calibration Test Design

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

The `576×288` maximum coordinate area of ​​the Even Hub plugin and the G2 system dashboard
Compare the perceived perimeter with actual glasses. This test is based on Sandevistan draft content.
It determines whether the plug-in display area itself is smaller than the dashboard, not the size.

## Discrimination range

This test answers the following questions:

- How far are the outermost pixels of the plugin actually visible?
- Are the four `288×144` image tiles seamlessly connected at the border and center?
- When switching to the dashboard, native content appears farther out than the edge of campus.
  Does it expand?

Specify the `640×350` area of ​​the official consumer specifications directly in the plugin, or
This test does not determine exactly what resolution the dashboard is rendered at.
No.

## Approach

Dedicated path `/calibration-max` without changing the existing root HUD and diagnostic path.
Add. This path draws the `576×288` correction pattern directly on the browser Canvas.
Afterwards, the 4-tile image transfer function of SDK `0.0.10`, which was already successful in the actual G2, is used as is.
Use it.

No separate image files or dependencies are added. If you draw the correction pattern in code,
Coordinates can be tested, and any reduction or margin of the original image is not mixed into the results.

## Calibration pattern

Draw the following elements at maximum brightness signal on a black background:

1. A 4-pixel outer band touching the coordinates `0` and the final coordinates `575` and `287`.
2. 2-pixel secondary border coming in 8 pixels from the outside
3. 2-pixel central cross covering `x=287~288`, `y=143~144`
4. 32-pixel interval grid in horizontal and vertical directions
5. `TL`, `TR`, `BL`, `BR` markings in each quadrant
6. `576×288 MAX` mark in the center

All lines are `fillRect` in integer coordinates to avoid half-pixel anti-aliasing.
Draw. Character markers use Canvas' fixed-width font, but the character shape is used for judgment.
Rather, it is based on the outer bands and graduations.

## App behavior

- When `/calibration-max` opens, draw the calibration pattern on the Canvas.
- The existing `transmitCanvas()` divides the Canvas into four `288×144` PNGs.
- Serially transmit in the following order: `relicTL`, `relicTR`, `relicBL`, and `relicBR`.
- The status text on the web screen displays the current transmission progress and failure point.
- The existing `/`, `/diagnostic-v10` operation and SDK version contract are not changed.

## Judgment procedure

1. Open the `/calibration-max` URL with the Even app developer QR scanner.
2. Check the transfer completion status of the four tiles.
3. Without moving the glasses, observe the outer band, secondary rim, and central cross.
4. Switch to the dashboard on G2 and compare to the outermost position of the content.

The results are interpreted as follows.

| Observation | Interpretation |
|---|---|
| Dashboard visible from outside campus | Native dashboards are likely to use wider viewports |
| Both perimeters are the same | Existing differences are most likely due to content density, brightness, or stereoscopic layers |
| Part of the outskirts of the campus were cut off | You may need to adjust your wearing position or the app's screen height settings first |
| Center cross broken or misaligned | 4Tile Placement or Image Transfer Boundary Problem |

## Error handling

If page creation or individual image transfer fails, the existing error message and container
The name is displayed on the web screen. In case of failure, there is no automatic retry or SDK change.
To preserve the initial success condition, the SDK is maintained at `0.0.10`.

## Automatic verification

- Check whether `/calibration-max` selects the calibration mode.
- Check whether the correction function correctly sets the Canvas to `576×288`.
- Check the integer coordinates of the outer bands, minor borders and central cross.
- Calibration mode also uses four image containers and the existing serial transmission path
  inspect.
- Run full Vitest, type checking, production build and site packaging tests.

## Completion conditions

- All automatic verifications, including existing tests, pass.
- Tailscale URL returns HTTP 200.
- In fact, four tile transfers are completed on G2.
- Users can provide comparison results between the campus perimeter and the dashboard exterior.
