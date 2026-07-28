# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Sandevistan design direction

- The selected visual target is `docs/design/selected-peripheral-focus.png`.
- Preserve a mostly empty center so the real world remains readable.
- Use a black/off background and monochrome green only.
- The static hardware prototype phase is complete. Connect live location,
  weather, OSM map data, and RSS news without changing the hardware-proven
  `/hud-canvas-fast` layout or image transport contract.
- Render the selected visual as one 576 x 288 Canvas frame, split it into four
  288 x 144 image containers, and keep the required event-capture text layer
  visually blank.
- The physical G2 checkpoint confirmed that the four-tile 576 x 288 HUD is
  clearly visible and fills the maximum SDK raster area. Adjust future visual
  scale and density inside this fixed frame rather than enlarging the canvas.
- Default to a non-navigation overview: keep the map, replace the center route
  and lower intersection cards with news, and show navigation only on its own
  page.
- Distribute the dense HUD across four circular scroll pages in this order:
  overview, navigation, news, and TODO/status. G2 and R1 bottom scroll advances;
  top scroll goes back.
- Keep the four image containers alive during page changes. Redraw the same
  Canvas and update container IDs 2–5 serially instead of rebuilding the page.
- Preserve `/hud-canvas` as the proven all-Canvas baseline. Test faster native
  text paging only on `/hud-hybrid`: send a text-free four-tile background once,
  then reuse the full-screen event-capture Text container for one in-place text
  update per scroll.
- Preserve `/hud-canvas` unchanged when testing `/hud-canvas-fast`. The fast
  route keeps the left 288 x 288 map identical on every page, puts every
  page-dependent pixel on the right, sends full frames in right-top,
  right-bottom, left-top, left-bottom order (IDs 3/5/2/4), and sends only
  right-side container IDs 3 and 5 after scroll.
- Use the high-contrast Canvas palette `#ffffff`, `#d0d0d0`, `#808080`, and
  `#000000` on `/hud-canvas-fast`, with 20–28 px core information.
- Hardware feedback approves the `/hud-canvas-fast` structure: preserve its
  large fixed map on the left and page-focused information area on the right.
- Hardware confirms the two-right-tile scroll transition feels very fast.
  Preserve the fast full-frame IDs 3/5/2/4 and navigation IDs 3/5 transport
  contract.
- Hardware accepts `fast-canvas-008` as the technical and visual baseline. Do
  not alter the split layout or transport contract without new hardware
  evidence.
- On `/hud-canvas-fast`, use the circular order overview, news, TODO, and
  navigation. User-forward scroll still advances pages 1→2→3→4, and no
  event-direction inversion is needed. Keep `/hud-canvas` on its original
  order.
- Show minute-only time plus `YYYY.MM.DD` and the Korean weekday. Fetch one SDK
  `0.0.11` `DeviceInfo` before initial fast-Canvas encoding and show its
  G1/G2/R1 battery on overview. Fall back to `BATTERY --` without blocking
  image transmission. Do not resend tiles every second or on device-status
  events.
- Keep six general-article samples on news, the three-item checklist plus daily
  progress on TODO, and the approved turn instruction on navigation.
- On `/hud-canvas-fast` only, replace double-tap shutdown with a serialized
  display toggle: send black IDs 3/5/2/4 to hide, ignore scroll while hidden,
  and resend the current IDs 3/5/2/4 to restore. Keep the event layer and app
  alive, update visibility only after successful transmission, and preserve
  legacy shutdown behavior on every other route.
- Tint only the WebView preview with a flat `#91ff73` multiply layer. Keep the
  transmitted grayscale Canvas palette unchanged and do not add preview
  shadows or radial glow.
- Keep general live features keyless: use the Even SDK for phone location,
  Open-Meteo for weather, allowlisted RSS feeds through the Sandevistan Worker, and
  OSM-derived road geometry rendered by Sandevistan's own Canvas code.
- The physical G2 approves SDK `0.0.11` for bilateral fast startup,
  `3/5/2/4` full transfers, `3/5` paging, and double-tap hide/restore. Use it
  as the live-data baseline; keep SDK `0.0.12` blocked until separately proven
  on the physical G2.
- Treat routing as optional. Enable OpenRouteService only when `ORS_API_KEY`
  exists in the server environment, keep the key out of WebView bundles and
  source control, and show a clear disabled state without breaking the
  keyless map, weather, or news experience.
- Give every fast-HUD dashboard tab a one-tap fullscreen detail deck. Keep the
  existing map zoom deck; show one RSS title and summary at a time for news;
  make the persisted TODO list selectable and tappable; and show one ORS
  maneuver at a time for navigation.
- In every fullscreen detail deck, scroll changes the page-specific selection
  and double tap returns to the originating dashboard tab. Dashboard double
  tap alone retains the black-frame display toggle.
- Use only sanitized RSS title, description, and publication time for the G2
  news reader. Do not fetch or render arbitrary article HTML.
- Persist at most six TODO items through Even local storage. The first detail
  implementation toggles the three approved seeded tasks and does not add
  editing controls.
- Preserve `/hud-hybrid` as the hardware-proven missing-z-order diagnosis.
  Test SDK `0.0.10` z-order backport only on `/hud-hybrid-z`: image layers
  1–4, Text layer 5, and no image resend during scroll.
- Hardware confirms `/hud-hybrid-z` keeps Text visible above Canvas and makes
  scroll text changes immediate. Align its single flowing Text block to one
  right-side `(196, 8, 372, 272)` console, keep the static map on the left, and
  avoid Canvas dividers that depend on native Text line height.
- Keep each custom TypeScript/TSX/CSS implementation file at or below 450
  lines. Split live providers, state, transport, and rendering by
  responsibility instead of extending the existing large modules.
