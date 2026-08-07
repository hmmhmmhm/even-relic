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
  Canvas and update container IDs 2–5 instead of rebuilding the page.
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
- Show minute-only time plus `YYYY.MM.DD` and the active locale's weekday. Fetch one SDK
  `0.0.11` `DeviceInfo` before initial fast-Canvas encoding and show its
  G1/G2/R1 battery on overview. Fall back to `BATTERY --` without blocking
  image transmission. Do not resend tiles every second or on device-status
  events.
- Keep six general-article samples on news, the three-item checklist plus daily
  progress on TODO, and the approved turn instruction on navigation.
- On `/hud-canvas-fast` only, replace double-tap shutdown with a serialized
  display toggle: rebuild to one blank full-screen event-capture container to
  hide without encoding or sending images, ignore scroll while hidden, and
  rebuild the image page before resending current IDs 3/5/2/4 to restore. Keep
  the app alive, update visibility only after a successful rebuild/transfer,
  preserve `?hide=black` as the former four-black-tile diagnostic, and preserve
  legacy shutdown behavior on every other route.
- Present the WebView preview in the phone companion's washed grayscale Even
  app treatment. Keep that phone preview independent from transmitted-tile
  compression and do not add preview shadows, green tinting, or radial glow.
- Keep general live features keyless: use the Even SDK for phone location,
  Open-Meteo for weather, three built-in RSS sources for each supported
  language plus up to six validated user-added HTTPS feeds through the
  Sandevistan Worker, and OSM-derived road geometry rendered by Sandevistan's
  own Canvas code.
- SDK `0.0.13` with Even App `2.2.6` and updated firmware passed bilateral
  startup, paging, detail, and hide/restore checkpoints, but later hardware
  use raised intermittent compression-stability concerns. Pin active builds to
  the proven SDK `0.0.11` fallback while retaining commit `1a364bd` as the
  pre-fallback `0.0.13` comparison point.
- Preserve the unchanged
  `0.0.12-reproduce` branch as the historical compressed-image failure sent to
  Even Realities. Do not describe the reproduction branch as the current host
  behavior.
- The query-free `/hud-canvas-fast` transport defaults to four in-flight SDK
  image calls and the `hud-4` transmitted palette. Preserve
  `?pipeline=1&levels=original` as the explicit rollback, and keep pipeline
  values 1 through 4 available for controlled diagnostics. Encode generated
  solid-black hide frames with the original path, then restore content with
  the resolved content palette.
- Physical SDK `0.0.13` evidence rejects serial transport as the production
  default: pipeline one increased intermittent one-sided and fully absent HUD
  output even though all four calls reported success. A general 200 ms wait
  after page creation and blank-display restoration did not improve it. Keep
  the hardware-proven four-call default and scope the 1 s neutral-page
  barrier only to the native Ask AI exit transition.
- Treat routing as optional. Accept a user-owned OpenRouteService key in the
  phone companion, persist it only in Even local storage, forward it through
  fixed same-origin routing endpoints without server persistence or logging,
  and retain `ORS_API_KEY` only as a local-development fallback. Never include
  any key value in a WebView bundle or source control.
- Give every fast-HUD dashboard tab a one-tap fullscreen detail deck. Keep the
  existing map zoom deck; show one RSS title and summary at a time for news;
  make the persisted TODO list selectable and tappable; and show one ORS
  maneuver at a time for navigation.
- In every fullscreen detail deck, scroll changes the page-specific selection
  and double tap returns to the originating dashboard tab. Dashboard double
  tap alone retains the black-frame display toggle.
- Use only sanitized RSS title, description, and publication time for the G2
  news reader. Do not fetch or render arbitrary article HTML.
- Persist at most six TODO items through Even local storage. The phone
  companion may add, rename, complete, uncomplete, and delete those items while
  the glasses detail deck keeps its approved selection and toggle interaction.
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

## Sandevistan phone companion direction

- Style the phone WebView after the owner-supplied Even app references: very
  light gray page background, white cards, restrained gray borders, black
  Pixelarticons, generous whitespace, and no glow or green treatment.
- Keep one live grayscale HUD preview above a two-column card grid. Use nine
  cards: Devices, HUD layout, News, TODO, Weather, Navigation, Language, and
  Ask AI, and Developer.
- Match the Even card proportions rather than perfect squares: approximately
  `1.28 / 1` width-to-height, subtle eight-pixel-equivalent corner rounding,
  a small icon near the top, and the title and status near the bottom.
- Every rounded dashboard card is the complete tap target for one focused
  detail screen. Do not add a separate Manage list or explanatory destination
  page to the shipped app.
- Fix Overview as the first HUD page. Let the phone enable, disable, and reorder
  News, TODO, and Weather; expose Navigation only after a user ORS key validates.
- Derive supported phone and HUD languages from `src/i18n/locale-registry.ts`.
  The resolved locale controls fixed phone and shipped `/hud-canvas-fast` copy,
  built-in sample TODO titles, weather labels, generic OSM `name:<language>`
  selection, and the active built-in RSS bundle. Never translate user-authored
  TODO text, RSS article content, destination names, or route instructions.
- Ship 180 complete locale packs. RTL locale packs set the phone companion root
  to RTL, while the nested 576×288 tactical HUD and Canvas remain LTR.
- Even Hub's current manifest schema accepts only `en`, `de`, `fr`, `es`, `it`,
  `zh`, `ja`, and `ko`. Keep all 180 app-internal locale packs available in
  the phone picker, but declare only that accepted subset in `app.json`.
- Add a language only through one complete `src/i18n/locales/<code>.ts` pack,
  including `direction`, one registry entry, and three entries in
  `server/news-feeds.js`. Do not add
  locale unions, language-picker choices, weather branches, route dictionaries,
  TODO title tables, or RSS URLs anywhere else.
- Resolve the saved locale before encoding the first fast-HUD frame. When no
  explicit locale is saved, use the device system language whenever it is in
  the registry; never flash an English HUD before the resolved locale HUD.
- Keep native sensors explicitly off outside their scoped features. On startup,
  best-effort stop audio, IMU, and stale location updates before enabling only
  what the active feature needs; stop them again on feature exit and app
  cleanup. In particular, the microphone must remain explicitly off unless an
  Ask AI or Conversate session owns it.
- Keep `server/news-feeds.js` as the single browser/server built-in RSS catalog.
  Its current 180-locale baseline is 540 HTTPS feeds. Every
  supported locale has exactly three non-deletable built-ins that may be
  disabled or renamed. Prefer validated local-language feeds; where none are
  available without redirects, explicitly reuse the three English international
  feeds with `fallbackLocale: "en"`. User-added HTTPS RSS sources remain shared across
  locales and retain the six-source limit.
- Run `npm run verify:rss-live` after any built-in feed change. It must check
  all feeds serially and reject redirects, non-200 responses, non-XML content,
  responses over 1 MB, missing RSS/Atom roots or items, and eight-second
  timeouts.
- Preserve bounded OSM `name:<language>` fields generically in the map Worker.
  A new locale must not require a map-server code change or a new hardcoded
  language-tag branch.
- Locale additions must not change the proven SDK `0.0.11` tile order,
  bilateral output, busy-drop behavior, or display-toggle transport contract.
- Finish Home with the Sandevistan project name, a Pixelarticons GitHub link to
  the repository, the Even app-manifest version, and the development status.
- Let the Even native bar own the `SANDEVISTAN` project title and arrow. Start
  WebView Home directly at the HUD preview, and use a text-only
  `Dashboard / Detail` breadcrumb to return from internal detail screens
  without rendering a second arrow.
- On every internal detail screen, retain the clickable breadcrumb and place
  one large localized white Back to Dashboard card immediately below it.
  Never render that card on Home. Reset document scroll to the top before each
  Home/detail screen change paints so this control cannot inherit an off-screen
  position from the previous screen.
- In HUD layout, pair every page label with a visible Pixelarticons checkbox
  state and keep the entire label-and-checkbox area as the enable/disable
  target. Keep the separate 44-pixel arrow controls for ordering.
- Add Ask AI as an optional fast-HUD dashboard page. Its compact dashboard
  panel previews short excerpts from the three most recent conversations and
  the locally estimated current-week/current-month Realtime spend, but merely
  viewing the panel must never start the microphone or an API session.
- Keep Conversate separate from Ask AI. Conversate assists a live human-to-human
  conversation with translation, contextual speaking tips, and selectable
  language/reply recommendations; it is not an Ask AI transcript or prompt
  variant and needs its own phone screen, HUD page, state, and input flow.
- Conversate keeps Transcription permanently on and defaults Translation,
  Inform, Prep Note, and Copilot on. Use `gpt-live-transcribe` for streaming G2 microphone captions,
  persist bounded conversation records only in Even local storage, translate
  speech outside the resolved UI language, and keep the four auxiliary controls
  independently configurable. An empty Prep Note is inactive and Prep Note is
  unavailable when Inform is off.
- Show Conversate Inform as a short bordered region above the transcript,
  auto-hide it after a configurable 10-second default, let one tap dismiss the
  current Inform or open its history when none is visible, use scroll to select
  earlier Inform items, and use tap to reopen the selection. Copilot provides
  three deliberately different replies with original text, pronunciation, and
  meaning; use the saved goal when present and infer it from recent context
  otherwise.
- Treat the live transcript as Conversate's non-negotiable primary surface.
  Always keep the newest heard text visible by default; translation, Inform,
  Copilot, status, and errors must never replace, hide, or block it. Ring/glasses
  scroll browses older transcript turns unless an auxiliary Inform or Copilot
  selector is explicitly open, and returning to offset zero resumes following
  the latest turn.
- Keep each translation directly paired with its source utterance. Limit
  Copilot to a compact auxiliary preview, clear stale choices as soon as new
  speech begins, and replace them only with suggestions analyzed from the
  latest completed or refined turn.
- Start a new text-only OpenAI Realtime conversation only after the user taps
  the Ask AI dashboard panel. Use the G2 glasses microphone by default, leave
  turn detection to semantic VAD, render user transcription and streamed AI
  text on the glasses, and stop the microphone and session immediately when
  leaving the detail deck.
- Render the Ask AI detail deck with one full-screen official Even Hub Text
  container. Rebuild once on entry, use `textContainerUpgrade` for combined
  user/listening updates at a queue-free 100 ms sampling cadence, acknowledge
  each assistant-grapheme update before starting its next 200 ms default delay,
  suppress image refreshes while the native page is active, and rebuild/send
  the established four-tile Canvas dashboard once on exit. Before that image
  rebuild, neutralize the frequently updated AI Text page with the proven
  blank event page. Wait a fixed 1 s for that neutral page before rebuilding
  the five-container image page, then wait another fixed 200 ms before encoding
  and sending IDs 3/5/2/4. Apply these two page-installation barriers only to
  Ask AI exit, keep dropping late Text upgrades throughout them, and do not add
  retries, queued refreshes, or forced tile resends.
- Keep Ask AI microphone ownership session-scoped: a normal detail tap flushes
  an already-complete answer or cancels an active Realtime response, reveals
  its received partial text, and resumes listening without closing the
  microphone. Double tap is the only exit and performs best-effort microphone
  cleanup without blocking Canvas restoration. Pace assistant presentation at
  one Unicode grapheme every 200 ms by default, keep authoritative Realtime state and
  persistence unthrottled, preserve the visible grapheme cursor when Realtime
  archives a completed response into conversation history or expands that
  archived response with late final text. Serialize a tap flush behind any SDK
  text update already in flight, emit only the newest complete target, ignore
  late deltas from the cancelled response, and localize every visible native
  detail string across all 180 locales.
- Keep the Ask AI detail view deliberately plain: no title, frame, phase
  header, page counter, or footer instructions. Show only the rolling
  localized conversation and a short localized `Listening…` line when
  applicable. Never show the response-pacing `Displaying response…` phase;
  append `Thinking…`, active tool status such as `Web search…`, and
  `Listening…` after the conversation instead of above it. Use one trailing
  activity slot, the full native text width for wrapping, and add exactly one
  blank display row whenever the speaker changes and immediately before a
  trailing `Listening…` status, without making either spacer a scroll target.
  Follow the newest line by default and move exactly one
  conversation line per glasses scroll gesture; never reintroduce transcript
  pages.
- Treat the OpenAI key as BYOK. Accept it only in the phone companion, persist
  it only in Even local storage, and use it from the packaged WebView only to
  mint a short-lived Realtime client secret directly from OpenAI. This
  owner-approved client-side BYOK flow supports serverless Private Builds;
  never bundle, log, or send the key anywhere else. Keep conversation excerpts
  and per-response usage/cost records local to the device.
- Let users add bounded HTTPS MCP servers from the phone Ask AI settings, with
  optional locally stored bearer authentication and tool allowlists. Register
  enabled servers directly with the Realtime session and require explicit
  approval for every MCP call. While approval is pending, one glasses tap
  approves; double tap rejects before leaving Ask AI. Never auto-approve,
  proxy, log, or server-persist user MCP credentials or traffic.
