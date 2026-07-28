# G2 Overview weather auxiliary information readability design

Date: 2026-07-27

Target path: `/hud-canvas-fast`

Base branch: `feature/g2-ors-routing`

Status: APPROVED

## Target

In the actual G2, add the following two lines at the bottom right of the first `OVERVIEW` dashboard.
Enlarge to make it easier to read.

- `Feeling 31° Humidity 67%`
- `Precipitation 20%, wind 8km/h`

## Selected design

Change the font size of the two lines from 11px to 14px. text position, phrase,
The rounding method for thickness, color, and weather values ​​is maintained.

13px is a small change and 15px can get a bit crowded in the current information frame, so
Choose 14px, which improves readability while maintaining existing margins.

## Implementation and verification

Apply 14px only to the two weather supplements in `src/fast-canvas-hud.ts`.
`src/fast-canvas-hud.test.ts` has a regression where both text is drawn at 14px
Add inspection.

After making changes, run the corresponding HUD test, type check, and build in series. Currently 4176
Maintain only one development server, hot reloaded from the same `detail-decks-019` URL.
Wait for actual G2 confirmation.

## Exclude range

- Change size of time, date and week weather text
- Change element position or frame size
- Change color, brightness and font thickness
- Change to a different dashboard or full screen detail deck
