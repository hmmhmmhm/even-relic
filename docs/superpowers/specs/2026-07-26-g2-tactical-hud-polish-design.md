# G2 Tactical HUD Policy Design

## Background

The first `576×288` Canvas HUD feels the same as the existing dashboard on the actual G2.
It was displayed in size, and large letters and maps were clearly readable. However, all information is the same
The game is placed in a thick closed square panel and the central rotation indication is expressed as a filled arrow.
It left the impression that it was closer to an instrument panel or management screen than a HUD.

This change changes the information hierarchy and graphics without affecting the successful size and transmission path.
Just improve the grammar.

## Target

- Completely removes the `ACC` panel and X/Y/Z values.
- Integrate `404,142,164×138` in the lower right corner into one large news/mission card.
- Increase key Korean phrases in news and missions to at least 17 pixels.
- Existing map size, time size, central guide area and `576×288` logical resolution
  maintain
- Open corners, cut lines, index marks and brightness hierarchy instead of repeated closed squares
  Creates the impression of a high-quality tactical gaming HUD.
- SDK `0.0.10` does not change the tile transmission method.

## Design direction

### 1. Open tactical frame

Do not draw the entire border of the main area. Each area contains 10 to 16 pixels.
Place only the corner brackets and short edges, with one selected key corner white.
Emphasize. Between frames there are small section indices such as `01`, `02`, `03` and short
Enter the scale.

This method maintains area separation while creating a feeling of layered dashboard boxes.
Reduce. Low brightness for frames, medium brightness for auxiliary information, only current action and path at maximum.
Use brightness.

### 2. Map depth

The map area `8,72,184×172` and the bottom legend `8,252,184×28` are maintained. The road network is
A single line of low brightness, with the active path being a 6-pixel mid-bright bottom line and a 2-pixel white line.
Overlap the center lines. The current location is indicated by an arrowhead and a small central incision, and the destination is
Expressed as a double square target.

### 3. Central direction guidance

The central area `204,72,188×130` is used as is, but the large filled arrow is removed.
Instead, the bending path is drawn with an 8-pixel mid-bright bottom line and a 3-pixel white center line.
Use visual language such as map paths. At the right end is an open arrowhead.
Connect. The information hierarchy is in the following order: `NAV // ROUTE 01`, `120m`, and `turn right`.

The bottom guide '204,214,188×66' contains 'next intersection', large 'right turn', and small direction.
Place symbols separately.

### 4. Right information structure

The microphone area '404,72,164×62' is maintained, but the waveform and baseline are further refined.

Remove `ACC` and all existing 50-pixel-high news boxes,
Combine into a single card of `404,142,164×138`.

- Top: `NEWS // 02`, `MISSION ACTIVE`
- Body: ‘To subway station’ 17 pixels, ‘Move’ 24 pixels
- Bottom: `ROUTE UPDATED`, `02:14`

The large text and ample line spacing make it immediately readable with actual glasses. left side of card
There is a vertical status line and a small progress scale at the edge to emphasize that it is a mission card.

## Fixed palette and typography

- Background: `#000000`
- Key information: `#ffffff`
- Line below the active path and auxiliary information: `#aaaaaa`
- Frame, road, decoration: `#555555`
- Monospace font: `"SFMono-Regular", Consolas, monospace`
- Time: 26 pixels
- Core action: 22-24 pixels
- News body: 17 pixels or more
- General information: 11 to 14 pixels
- Fine label: 8-10 pixels

Do not increase the number of colors or use blur, shadow, or transparency effects. G2's
Priority is given to monochromatic raster conversion and actual display characteristics close to 1 bit.

## Compatibility and off-target

- The `/hud-canvas` path and the `drawDenseCanvasHud()` public function name are maintained.
- Root image HUD, diagnosis, and correction path do not change.
- Real-time sensor connectivity, news API, and location data binding are out of scope.
- Do not replace Canvas with image assets or SVG.
- Transmission retry and BLE protocol do not change.

## Automatic verification

- Check that the Canvas is exactly `576×288`.
- Check that the `ACC` and X/Y/Z strings are not drawn at all.
- `NEWS // 02`, `MISSION ACTIVE`, `To the subway station`, `Move` are drawn
  Make sure the text in the text is 17 pixels or longer.
- Is the corner of the right integrated card drawn on the border between `404,142` and `568,280`?
  Confirm.
- Are there both a medium-bright bottom line and a white center line on the map and central guidance?
  Confirm.
- Make sure the entire palette is limited to the four existing colors.
- Passes full testing, type checking, production build, and Sites packaging testing.

## Judgment of practical equipment

Change the build identifier of the Tailscale URL to `tactical-hud-002`. In G2
Check the following items.

- Does it maintain the same size and clarity as the existing version?
- Are the news and mission statements easy to read at a glance?
- Did the visual space and hierarchy of the right area improve after ACC removal?
-Aren't open corners and dual paths blurry?
- Don't the compass, map path, and central directions look disconnected at the boundaries of the four tiles?
