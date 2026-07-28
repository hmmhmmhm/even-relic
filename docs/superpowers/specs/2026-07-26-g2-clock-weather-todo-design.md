# G2 clock/weather/TODO HUD design

## Target

The following information is maintained while maintaining the size and transmission stability of the current Tactical Canvas HUD:
Add.

- Displays the clock in `HH:MM:SS` format.
- A mock-up of the ‘HONGDAE 23°C clear’ weather is displayed below the clock.
- Change `MISSION ACTIVE` to `TODO // ACTIVE` and check the incomplete/complete checkbox.
  Draw it yourself.

## Clock operation

`drawDenseCanvasHud(canvas, now?)` accepts an optional `Date`. the caller
If the time is not given, the browser's `new Date()` is used. Hour, minute, and second respectively
Set it to two digits and draw it like `14:37:42`.

The G2 screen is a static screen that divides the Canvas into four images and transmits them once. this time
The change displays the actual seconds at the time of transmission, but does not retransmit four images every second.
No. This is a choice to protect BLE transmission volume and already verified single-shot transmission contracts.

The time font has been changed to avoid truncating the 8-digit time within the existing 132-pixel time frame.
Adjust from 26 pixels to 22 pixels. One line below the clock is in 9-pixel monospace font.
Displays region, temperature and status together. Remove the existing `// 01` decoration to change the weather and
Make sure they do not overlap.

## Weather

The weather is currently a static mockup, like the map, mission, and microphone values.

```text
HONGDAE 23°C Clear
```

External API, location permissions, and network failure handling are not included in this scope.
Real-time weather connection is handled as a separate feature after verifying the static UI and transmission stability.

## TODO Card

The right `404,142,164×138` frame and large text size are maintained.

- `NEWS // 02`
- `TODO // ACTIVE`
- Empty 12 pixel checkbox + ‘To subway station’
- 24 pixels indented `move`
- Checked 10 pixel checkbox + `Confirm path`
- Completion time `02:14`

Check boxes are drawn with Canvas squares and lines instead of Unicode symbols. The unfinished box is
It has only a white outline and a black interior, and the completion box has two lines within the same outline checked.
Draw. The existing vertical status line and progress scale were removed to visually replace the checkbox and
Don't compete.

## Automatic verification

- If you give a fixed time of `2026-07-26 14:37:42`, `14:37:42` will be set to 22 pixels.
  Check if it is drawn.
- Check if `HONGDAE 23°C Clear` is rendered.
- `MISSION ACTIVE` and `ROUTE UPDATED` disappear and `TODO // ACTIVE`,
  Verify that `path resolution` is rendered.
- Check the outer and inner coordinates of the empty checkbox and the completed checkbox.
- Verify that the completion check path is drawn as a white line.
- The existing 4-color palette, `576×288` size, and map/route rendering contract are maintained.

## Check actual device

The build identifier is `hud-info-003`.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=hud-info-003
```

In G2, checkbox and two-line mission are checked to ensure that the second-by-second time and weather line do not overlap.
Make sure they are distinguished immediately.
