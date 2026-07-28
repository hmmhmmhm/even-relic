# G2 High Density Canvas HUD Design

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

Existing Sandevistan HUD time, location, compass, map, microphone, acceleration, route guidance and
Recreate directly on the `576×288` Canvas without the original PNG while maintaining the quest configuration.
Draw. Elements and letters are grown and blackened within the maximum perimeter identified in the calibration test.
Reduce the blank space to create a HUD that feels similar in size to the system dashboard.

## Success Criteria

- `/hud-canvas` does not read the original image, only Canvas primitives and text.
  Use it.
- The logical screen is exactly `576×288`.
- The map, central guidance, and right sensor panel occupy a larger area than the existing version.
- Does not change the existing `/`, `/diagnostic-v10`, and `/calibration-max` operations.
- Reuse the four image container serial transmission paths of SDK `0.0.10`.
- In the real G2, four tiles are displayed and the HUD elements are larger than the original image cyan.
  Users can compare how they feel.

## Rendering Structure

A new `src/canvas-hud.ts` is dedicated to rendering. This module supports the Even Hub bridge or
It does not depend on React and takes only one input, `HTMLCanvasElement`.

`App.tsx` calls a new renderer from the `/hud-canvas` path. When rendering is finished
The existing `transmitCanvas()` divides the Canvas into four `288×144` pieces.
Transmit in the following order: `relicTL`, `relicTR`, `relicBL`, and `relicBR`.

## Visual principles

- Leave the background completely black to reflect the real environment.
- Use only three levels: maximum brightness, medium brightness, and low brightness.
- Assuming that G2 is converted to the green layer, Canvas
  Use `#ffffff`, `#aaaaaa`, and `#555555`.
- All panels and lines are drawn with a `fillRect` in integer coordinates and a 1-pixel path.
- Characters use a fixed-width font, 16 to 26 pixels for core information, and 16 to 26 pixels for auxiliary information.
  Draw at 10 to 13 pixels.
- The peripheral information structure of the existing draft is maintained, but the central route guidance is increased to reduce empty space.
  Reduce.

## Fixed Layout

| area | Coordinates and Size | Content |
|---|---|---|
| Time/Location | `8,8,132×54` | `14:37`, `HONGDAE` |
| compass | `148,8,276×54` | scale, `N`, `NE 047°`, `E` |
| Link decoration | `432,8,136×54` | Top right frame and signal bar |
| map | `8,72,184×172` | Road network, highlighted route, current location arrow |
| Map legend | `8,252,184×28` | Show scale and destination |
| Central Information | `204,72,188×130` | Big right turn arrow, `NEXT 120m`, `right turn` |
| Bottom instructions | `204,214,188×66` | `Turn right at the next intersection` |
| microphone | `404,72,164×62` | `-24 dBFS`, level bar |
| acceleration | `404,142,164×80` | `X +0.12`, `Y -0.03`, `Z +0.98` |
| Quest·News | `404,230,164×50` | `Q. Move to subway station`, `NEWS 02` |

Maintain a gap of at least 8 pixels between panels. All areas are outside the Canvas and
Keep a safe distance of 4 pixels or more.

## Map and direction display

Maps are drawn as Canvas line segments, not as simple decorative images.

- Repeated placement of low-brightness horizontal, vertical, and diagonal roads.
- The path of maximum brightness is indicated by three thick lines.
- The current location is indicated by a filled triangle pointing upward.
- The destination is indicated by a small square marker.

Central guidance uses a thick arrow that bends to the right. Route guide text
It is displayed larger than the existing bottom line, and the distance and motion are divided into two steps.

## Error handling

If the 2D Canvas context is not obtained, an explicit error is thrown, just like the existing renderer.
throw it Errors in page creation or individual tile transmission are consistent with the existing status output.
Use `transmitCanvas()` error handling as is. Automatic retry or SDK changes
do not add

## Automatic verification

- Check whether the renderer sets the Canvas to `576×288`.
- Inspect the border coordinates of the main panel and the three brightness palettes.
- Check that the map route and center right turn arrow are drawn.
- Check that all key characters and fixed mockup values ​​are rendered.
- Check that `/hud-canvas` picks up a new renderer and four image containers.
- Check whether the tests of the existing route and the three diagnostic routes continue to pass.
- Run type checking, production builds, and Sites packaging tests.

## Hardware judgment

Even App Developer Open `/hud-canvas` with QR scanner and wait for four tiles to be sent.
Compared to the existing image HUD, the following is recorded:

- Are the time, compass, map, and sensor letters larger and easier to read?
- Does the central guide make the screen feel larger without excessively blocking the field of view?
-Are there any breaks in the lines or characters at the boundaries of the four tiles?
- Is the overall information density sufficient compared to the system dashboard?
