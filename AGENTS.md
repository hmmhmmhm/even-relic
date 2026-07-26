# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## RELIC design direction

- Before changing the G2 image path, read
  `docs/2026-07-26-g2-image-debugging-handoff.md`.
- The selected visual target is `docs/design/selected-peripheral-focus.png`.
- Preserve a mostly empty center so the real world remains readable.
- Use a black/off background and monochrome green only.
- The first hardware prototype is static. Connect only the Even Hub image
  pipeline; do not connect sensors, maps, STT, news, or other live data yet.
- The current hardware diagnostic uses four 200 x 100 PNG tiles centered as a
  400 x 200 HUD. Do not change image format or density again until a fresh
  one-image startup page returns `success`.
- Keep `@evenrealities/even_hub_sdk` pinned to 0.0.11 for image tests. Version
  0.0.12 sends `compressMode: 2` and returned `SENDFAILED` on the tested
  iPhone and G2.
- Register exit handling before operations that can fail so a failed page does
  not become an unclosable stale session.
- Keep each custom TypeScript, TSX, or CSS implementation file at or below
  450 lines.
