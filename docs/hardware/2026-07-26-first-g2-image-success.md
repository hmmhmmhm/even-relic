# First successful record of G2 image transmission

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Summary

On 2026-07-26, Sandevistan transmitted images to a physical Even G2 for the
first time. The confirmed SDK for this checkpoint was
`@evenrealities/even_hub_sdk` `0.0.10`.

The following two routes succeeded consecutively on the same device and Even app session.

1. `/diagnostic-v10`: one user click sends a `200×100` 1-bit BMP.
2. `/`: four `288×144` PNGs compose the complete `576×288` HUD.

The diagnostic BMP showed a small dot pattern. With all four tiles visible, the
user reported that the full HUD was clear and appeared larger than the
diagnostic BMP.
Confirmed.

## Comparison of initial failure and success

| order | SDK | path | Image and viewpoint | Real G2 Results |
|---:|---|---|---|---|
| 1 | `0.0.12` | `/` | Immediately after starting, four `288×144` Canvas PNG | `SENDFAILED` in first `relicTL` |
| 2 | `0.0.12` | `/diagnostic-v10` | After clicking `200×100` 1-bit BMP | `SENDFAILED` |
| 3 | `0.0.10` | `/diagnostic-v10` | Same Click, Same BMP | `success`, display small dot pattern |
| 4 | `0.0.10` | `/` | Same 4-tile full HUD | All four tiles displayed, the screen is crystal clear |

In the second experiment, we ruled out automatic transfer timing and issues specific to large PNGs. third
In the experiment, the image, container, click time, and device were left as is, and only the SDK version was used.
I changed it.

## Changes that created success

I fixed the SDK to exactly `0.0.10` and matched the relevant metadata together.

```json
{
  "dependencies": {
    "@evenrealities/even_hub_sdk": "0.0.10"
  }
}
```

```json
{
  "min_sdk_version": "0.0.10"
}
```

`0.0.12` adds the following fields to the result of `ImageRawDataUpdate.toJson()`.

```json
{
  "compressMode": 2
}
```

`0.0.10` serializes the same image request as follows:

```json
{
  "containerID": 3,
  "containerName": "frame",
  "imageData": [1, 2, 3]
}
```

`src/sdk-version.test.ts` in the repository contains the SDK, app manifest, and QR metadata.
Checks for a match of `0.0.10` and absence of `compressMode`. do not remove this contract test
Do not upgrade the SDK version without this.

## Reproduction Procedure

### 1. Prepare dependencies and verification status

```bash
npm ci
npm ls @evenrealities/even_hub_sdk
npm test
npm run typecheck
npm run build
npm run test:sites
```

The `npm ls` result should be `@evenrealities/even_hub_sdk@0.0.10`.

### 2. Run Tailscale server

Turn on and run Tailscale on your Mac and iPhone.

```bash
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

At the time of initial success, Mac's Tailscale IPv4 was `100.96.68.73`. address is
If it has changed, change the URL below with the result of `tailscale ip -4`.

### 3. Small manual transfer confirmation

```bash
npx evenhub qr \
  --url "http://100.96.68.73:4173/diagnostic-v10?sdk=0.0.10&build=sdk-0010-ab" \
  --external
```

Scan the QR in the Even Hub developer area of ​​the Even app.
When you see ‘TEXT READY - CLICK TO SEND’, press R1 on the G2 touch bar once.
The success status is ‘1-bit BMP transmission completed’.

### 4. Check the entire HUD

```bash
npx evenhub qr \
  --url "http://100.96.68.73:4173/?sdk=0.0.10&build=hud-4tile-sdk0010" \
  --external
```

The entire HUD is automatically transmitted without clicking. `relicTL`, `relicTR`, `relicBL`,
All four cards must succeed in `relicBR` order.

## Compare maximum display area

On the same day, in `/calibration-max`, the outer band, auxiliary border,
The central cross and 32-pixel scale were transferred to four tiles.

The following URL was used for actual testing.

```text
http://100.96.68.73:4174/calibration-max?sdk=0.0.10&build=max-boundary-001
```

As a result of comparing by switching to the G2 system dashboard with the calibration pattern displayed,
The user confirmed that the visible outline size of the two screens was the same.

These results are based on the Even Hub plugin's current wearing position and screen height settings.
`576×288` The maximum coordinate area does not appear smaller than the system dashboard.
It's hardware based. The dashboard's exact internal rendering resolution or pixels relative to the physical panel.
It does not even prove the correspondence relationship.

The main reason why the existing Sandevistan draft felt smaller was the black margin than the screen limit,
Differences were narrowed down to low luminous pixel density, brightness, or native stereoscopic layer differences.

## High-density Canvas HUD actual device results

Reflecting the correction results, `576×288` without the original image in `/hud-canvas`
Redrawn HUD with Canvas primitives and text. Yes in the same SDK `0.0.10`
It was transmitted via the tile path and was displayed normally on the actual G2.

The results confirmed by the user are as follows.

- The time and text were large and clearly readable.
- Map size and route visibility were satisfactory.
- The entire exterior felt the same size as the system dashboard.
- Dashboard than the game HUD due to the same closed square border and larger filled arrows
  It looked closer to a dashboard.
- Combining the small ACC and News sections and increasing the News text is the next priority.
  It has been decided.

This results in maximum display area, direct rendering to Canvas, four tile transfers and large text.
Readability was also confirmed on an actual device.

## Tactical HUD candidate `tactical-hud-002`

The next candidate that reflects the above feedback maintains the transmission protocol and screen size as is.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=tactical-hud-002
```

The changes are as follows:

- ACC and X/Y/Z values ​​were removed.
- The bottom right corner has been integrated into a `164×138` news/mission card.
- ‘To the subway station’ was enlarged to 17 pixels, and ‘Move’ was enlarged to 24 pixels.
- The closed square panel was replaced with an open corner bracket.
- The map route and center rotation instructions have been unified into a double line.

In reality, G2 determines the following items.

- [ ] The news text is clearly read larger than the existing 10-pixel text.
- [ ] The open corner frame divides the area without interruption in G2.
- [ ] The dual routes of the map and central directions are not lumped together.
- [ ] Key information is not lost at the four tile boundaries.
- [ ] Maintains the overall size and clarity of the existing Canvas version.

## Information extension candidate `hud-info-003`

Added second-by-second time, weather line, and TODO check status to tactical HUD candidates.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=hud-info-003
```

The clock displays the actual local time as `HH:MM:SS` when the page draws the Canvas.
Display. It maintains a transmission contract that only sends the four tiles once, so the
The seconds are not updated every second. `HONGDAE 23°C CLEAR` is in line with the rest of the HUD data.
It's the same static mockup.

TODO cards do not rely on check characters in fonts. Incomplete box, completed box and
Check lines can be drawn directly as a Canvas shape and the state will be maintained even in the G2's monochromatic raster.
made to be differentiated.

In reality, G2 determines the following items.

- [ ] `HH:MM:SS` is not truncated within the time frame.
- [ ] Region, temperature, weather can be read in one line.
- [ ] Incomplete boxes and complete checks are distinguished from each other.
- [ ] TODO body size remains as large as the previous mission card.
- [ ] The existing tactical frame and dual path are clear as is.

## Paged HUD candidate `paged-hud-004`

While maintaining the amount of information in the high-density dashboard on one screen, G2 and R1 scrolling
Four pages were added so that detailed information can be viewed distributed across a large page.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=paged-hud-004
```

The page order is `OVERVIEW → NAVIGATION → NEWS → TODO` and at the end
Scroll down to return to `OVERVIEW`. The scrolling above is in reverse order.
The default `OVERVIEW` is a non-navigation state, with a large route/intersection card instead of a central route/intersection card.
Displays local news and weather briefings.

Do not reconfigure the page container when scrolling. Same 576×288 Canvas
After redrawing, container IDs 2, 3, 4, and 5, which are the same as the initial success path, are drawn in order.
Update. Even fast continuous scrolling is processed in one queue for BLE image updates.
There is no overlap.

News, weather, maps and to-dos are still static mockups. Next on the actual G2 and R1
Judge the item.

- [ ] Immediately after refreshing, the `01 / 04` basic news screen is visible in both eyes.
- [ ] ‘Right turn’ and ‘Next intersection’ do not appear on the basic screen.
- [ ] G2 Down and up scrolling moves to the next and previous pages, respectively.
- [ ] R1 Down and up scrolling also moves in the same direction.
- [ ] If you scroll down from `04 / 04`, it will cycle to `01 / 04`.
- [ ] The phenomenon of being left with only one eye after switching pages does not recur.
- [ ] Even if partial tiles are visible during transmission, four tiles are displayed on one screen after completion.
  Converge.

## Hybrid Native Text candidate `hybrid-text-005`

Instead of re-sending the entire Canvas page with four images per scroll, text
The common background that does not exist is sent only once the first time, and only the page text is used as native text.
An updated A/B route was added.

```text
http://100.96.68.73:4173/hud-hybrid?sdk=0.0.10&build=hybrid-text-005
```

The start page has the same image container IDs 2–5 and full screen event as before.
Use Text ID 1. After all four images are sent, the first `OVERVIEW`
Post the text. Afterwards, scrolling down and up moves image data or page containers.
Update the content only once with the same Text ID 1 without touching it. quick succession
Input is processed through serial queues.

This path supports native text and images without explicit z-order in SDK `0.0.10`.
It is also a diagnostic test to check whether backgrounds can overlap. The automatic test is that the image
It does not increase after the initial four times and the maximum number of concurrent executions of Text updates is
It was verified that it was 1.

- [ ] Native text is displayed over the static frame/map background.
- [ ] The Canvas background is visible in the transparent area of ​​the Text container.
- [ ] ‘Line 2 operates normally’, ‘Turn right →’ Korean and arrows are read.
- [ ] `[ ]` and `[x]` check states are distinguished from each other.
- [ ] When scrolling down or up, the entire text changes at once.
- [ ] conversion is definitely faster than updating the four images in `paged-hud-004`.
- [ ] The same phrase is visible at the same time in both eyes.

If the stacking order or font display fails, keep this path for diagnostic purposes.
Continue to use `/hud-canvas` as the default candidate.

## Explicit layer candidate `hybrid-zorder-006`

In the `hybrid-text-005` actual device test, only the Canvas layout was visible as usual.
Native Text appears while the System Close panel is open, and closes the panel.
As soon as I canceled it, it disappeared again. It's not a text transmission failure, it's behind your image
It was determined to be a problem with the order of layers being composited.

SDK `0.0.10` maintains image transfer and sends images 1–4 to five container JSONs,
Added a separate route to inject Text 5's unique `zOrderIndex`.

```text
http://100.96.68.73:4174/hud-hybrid-z?sdk=0.0.10&build=hybrid-zorder-006
```

2026-07-26 As a result of checking the actual device, Text is in front of the Canvas layout without a close panel.
It was displayed normally. Even when scrolling, the text appears instantly without waiting for the image to be resent.
changed. Therefore, an explicit `zOrderIndex` backport and a single Text update method are
It is determined that the layer order and transition speed issues have been resolved, respectively.

The remaining problem is that one full screen Text flows like a normal document starting from `(8, 8)`.
On the other hand, the Canvas background is drawn assuming multiple panel coordinates. in result
The text is visible, but it is not aligned correctly with the frame of each panel. Blank or
Rather than mimicking coordinates with line breaks, reorganize the Canvas to fit a single Text area, or
You have to choose between positioning multiple Text containers.

- [x] Text is displayed on the Canvas without a close panel.
- [ ] Even if you cancel the close panel, the text remains visible.
- [x] Scroll only updates the text once without retransmitting the image.
- [x] Four image layouts and text are displayed together.
- [ ] Text is aligned exactly with the position of each panel on the Canvas.
- [ ] The same text and layout are visible on both sides.

## Single Text Console Sort Candidate `hybrid-console-007`

Canvas while maintaining a single Text update as seen by `hybrid-zorder-006`
The frame was reorganized to fit the native text flow. Left `(8, 8, 180,
272)` is a fixed map, and `(196, 8, 372, 272)` on the right is one text.
It's a console.

The Text container also uses the same coordinates and size as the right console, with padding
It is `8px`. All horizontal dividers that matched the native row height were removed. each
The page was fixed with two lines for common status, one blank line, and five lines for page information.
When scrolling, only one text string is updated without retransmitting the image.

```text
http://100.96.68.73:4174/hud-hybrid-z?sdk=0.0.10&build=hybrid-console-007
```

- [ ] The map on the left appears large in an independent frame.
- [ ] The entire text on the right is visible within the console frame.
- [ ] Text does not overlap on the map or frame lines.
- [ ] Four pages are switched immediately with one scroll.
- [ ] The time, weather, and page number in seconds are displayed without line breaks.
- [ ] The same map and text are visible on both sides.

## Fast Split Canvas Candidate `fast-canvas-008`

Better than the existing four-tile transfer while avoiding the fixed font and brightness of native text.
Added a separate `/hud-canvas-fast` path to test fast Canvas switching.
The existing multi-sections `/hud-canvas` and `paged-hud-004` were not changed.

The left side of the new screen, `288×288`, is a large map that is the same on all pages. right
`288×288` contains the time in seconds, weather, page number, and each page information.
Draw with key characters `20–28px`. The palette is `#ffffff`, `#d0d0d0`,
There are four steps: `#808080` and `#000000`.

The first screen sends image IDs `2, 3, 4, 5` as before. When scrolling
Redraw the entire Canvas, but add `relicTR` in the upper right and `relicBR` in the lower right,
That is, only IDs `3, 5` are encoded and transmitted serially.

```text
Existing: http://100.96.68.73:4174/hud-canvas?sdk=0.0.10&build=paged-hud-004
New: http://100.96.68.73:4174/hud-canvas-fast?sdk=0.0.10&build=fast-canvas-008
```

2026-07-26 In the first confirmation of the actual G2, users said that the new structure was very good.
evaluated. Therefore, the fixed large map on the left and the page-specific information area on the right
Divisions are preserved according to approved design standards. This evaluation is about the screen structure.
It's confirmation. In the subsequent scroll test, it was confirmed that the switching speed was also very fast.
In the final confirmation, it was evaluated as excellent enough that only the content needed to be decided. thus
The sequential updating of the two tiles on the right is said to be natural, with no seams that interfere with use.
The decision is made and `fast-canvas-008` is adopted as the technology and design baseline.

- [x] I am satisfied with the new structure that divides the left map and right information.
- [x] Key letters on the new screen are larger and brighter to read than on the existing Canvas.
- [x] The map on the left does not blink or change during page switching.
- [x] The top and bottom right sides change naturally as if they were one screen.
- [x] The conversion time is shorter than the existing four-tile Canvas and feels very fast.
- The page order is maintained even if you continuously input [ ] scroll.
- [ ] The same map and information are visible in both eyes.
- [x] Adopt the current structure and transmission method as the technology and design baseline.

Continuous scrolling and binocular matching are separate regression tests that do not prevent baseline adoption.
maintain

## Content candidate `fast-content-009`

Following page order and sample content while maintaining approved split and transfer agreements:
changed together.

1. `OVERVIEW`: Single G1/G2/R1 battery returned by SDK, weather, TODO progress
2. `NEWS`: Six general article titles instead of map and transportation samples
3. `TODO`: Three checkboxes and today’s completion progress
4. `NAVIGATION`: Information on the existing 120m right turn and the next intersection

The clock is in the format `HH:MM` with seconds removed. SDK `0.0.10`
`getDeviceInfo()` provides the battery and charging status of a single device, but can
Devices are not listed simultaneously. Battery lookup before first image encoding
Run once. If the lookup fails, type `BATTERY --` and transfer your tiles.
Continue. Does not automatically retransmit images due to device status events or timers every second.

```text
Baseline: http://100.96.68.73:4174/hud-canvas-fast?sdk=0.0.10&build=fast-canvas-008
Content: http://100.96.68.73:4175/hud-canvas-fast?sdk=0.0.10&build=fast-content-009
```

- [ ] OVERVIEW shows the actual single device battery or `BATTERY --`.
- [ ] The clock appears as `HH:MM` without seconds.
- The scroll order below [ ] is OVERVIEW, NEWS, TODO, NAVIGATION.
- [ ] NEWS's six general article titles are read separately.
- [ ] At the bottom of TODO, ‘Complete 1 / 3’ is displayed instead of the connection status.
- [ ] NAVIGATION is the fourth, and the existing right turn guidance is maintained.
- [ ] When scrolling, the map on the left is fixed and only the two tiles on the right change quickly.

## Display toggle candidate `fast-sleep-010`

Added ‘YYYY.MM.DD day of the week’ below the clock. The time is `HH:MM`, every minute
Do not automatically retransmit.

SDK `0.0.10` does not have a public API to put the display to sleep while maintaining the app.
Therefore, we replaced the double-tap exit call with the Show Next toggle only in fast Canvas.

- Double tap during display: Serial transmission of black image ID `2, 3, 4, 5`
- Scroll while hidden: no page changes and no image transfers
- Double tap while hiding: Serial restoration of current HUD image ID `2, 3, 4, 5`
- Hiding/restoration failure: Maintain the existing display status and retry with the next double tap.

The image container and event capture text layer remain alive, so the G2 and
You can receive the double tap of R1 again. This is not an official low power mode but a black
This method only hides the HUD display using pixels. Double tap on other paths such as `/hud-canvas`
The termination action remains the same.

Only the preview of the WebView was colored green with the `#91ff73` multiply layer. background
Radial glow and frame shadows have been removed. Glasses Transfer Canvas
The `#ffffff`, `#d0d0d0`, `#808080`, and `#000000` palettes remain the same.

```text
Content: http://100.96.68.73:4175/hud-canvas-fast?sdk=0.0.10&build=fast-content-009
Toggle display: http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.10&build=fast-sleep-010
```

- [ ] `YYYY.MM.DD day of the week` is displayed without overlapping with the weather and page number.
- [ ] WebView preview is green and has no luminous effect.
- [ ] G2 Double tap to turn off all HUD pixels.
- [ ] Even double tapping R1 turns off all HUD pixels.
- [ ] Even if you scroll while hidden, the HUD does not appear or the page does not change.
- If you double-tap [ ] again, the page before hiding will be restored.
- [ ] After restoration, page conversion speed is the same as before.
- [ ] The double tap exit behavior of other HUD paths is maintained.

## Current Conclusion

In the current Even app and G2 firmware combination, the image path of SDK `0.0.10` works and
An image path of `0.0.12` returns `SENDFAILED`. A/B results are
The image transmission method added in `0.0.12` is not compatible with the current host environment.
It's a strong basis.

This record alone confirms that neither the Even app nor the G2 firmware supports the new transfer method.
It is impossible to tell whether it is or not. Exact Even app version and G2 firmware at the time of initial success
Version could not be collected.

## Safe next steps

- The current operating baseline is maintained as SDK `0.0.10`.
- To make the HUD feel larger, increase the screen coordinates instead of increasing the central content and lighting.
  Increase pixel density.
- Record the Even app and G2 firmware versions and update them.
- Retest SDK `0.0.12` only in the separate diagnostic branch.
- In `0.0.12`, before both manual BMP and full HUD succeeded, the default branch's
  Do not upload SDK.

## Related commits

- `f094089`: SDK `0.0.10` A/B contract and serialization test
- `ca81e0a`: Manual BMP hardware success log
- `a1a1dcf`: HUD success record for all 4 tiles
- `69bac2c`: Successful record of high-density Canvas HUD practical device

## References

- [Even Realities official image template](https://github.com/even-realities/evenhub-templates/tree/main/image)
- [SDK `0.0.12` npm package](https://www.npmjs.com/package/@evenrealities/even_hub_sdk/v/0.0.12)
