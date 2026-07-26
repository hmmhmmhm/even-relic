# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## RELIC design direction

- The selected visual target is `docs/design/selected-peripheral-focus.png`.
- Preserve a mostly empty center so the real world remains readable.
- Use a black/off background and monochrome green only.
- The first hardware prototype is static. Connect only the Even Hub image
  pipeline; do not connect sensors, maps, STT, news, or other live data yet.
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
- Preserve `/hud-hybrid` as the hardware-proven missing-z-order diagnosis.
  Test SDK `0.0.10` z-order backport only on `/hud-hybrid-z`: image layers
  1–4, full-screen Text layer 5, and no image resend during scroll.
- Keep custom TypeScript/TSX/CSS implementation code at or below 450 lines in total.
