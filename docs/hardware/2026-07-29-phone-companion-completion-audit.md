# Sandevistan Phone Companion Completion Audit

Date: 2026-07-29

Target branch: `main`

Audited implementation commit:
`a5d57a39aa4af3a483cb2413093ab4f57f0a33ae`

Overall status:
`SOFTWARE PASS — PHYSICAL G2 BASELINE PRESERVED — VISUAL CAPTURE PENDING`

This audit covers the phone WebView companion added around the persistent
576×288 G2 Canvas. It supplements, rather than replaces, the physical G2
readiness audit. Release tagging and Even Hub submission remain deferred by
the owner.

## Completed phone capabilities

| Capability | Result |
| --- | --- |
| Even-style light Home with eight full-card destinations | PASS |
| Neutral grayscale HUD preview without green glow | PASS |
| Compact WebView subheaders below the native Even app bar | PASS |
| Persistent Canvas across Home/detail navigation | PASS |
| G2/R1 status, battery, SDK, and bilateral status screen | PASS |
| HUD page enablement and ordering | PASS |
| RSS source add, rename, enable, disable, and delete | PASS |
| Phone TODO add, edit, toggle, reopen, and delete | PASS |
| Weather detail and immediate fail-fast refresh | PASS |
| Device-local ORS key validation, masking, and deletion | PASS |
| English/Korean/System phone language selection | PASS |
| Localized destination search, travel modes, route actions, and errors | PASS |
| Developer-only WebView trace panel | PASS |
| Project, GitHub, version, and development-state footer | PASS |

## Quality corrections in the audited commit

- Restored a semantic level-one heading to the Home section header.
- Localized the live HUD preview landmark and development-key fallback.
- Applied the selected phone locale to all route controls and route errors.
- Replaced the TODO check-mark text glyph with local Pixelarticons assets.
- Converted app-manifest permission descriptions to English.
- Replaced the exact-count Vitest badge with a non-stale `400+` badge.
- Updated the two phone design specifications from implementation-pending to
  implemented with visual comparison pending.
- Extracted Canvas, bridge, live-session, input, and transport coordination
  from the 760-line `App.tsx`; route composition is now 334 lines and each new
  controller module remains at or below 450 lines.
- Made a device-local ORS key immediately expose Navigation in the editable HUD
  layout, even when no development-server key exists.
- Made ORS-key deletion independent of live-session availability so a local
  secret can always be removed after confirmation.
- Added recoverable, localized failure states for phone language persistence
  and manual weather refresh.
- Added live Developer counters for trimmed trace entries and refreshes dropped
  by the no-queue coordinator.
- Corrected the TODO completion icon and added interaction-level coverage for
  add, rename, toggle, confirmed deletion, last-item protection, and storage
  rejection.
- Cleared both the local ORS key and persisted active-route cache on confirmed
  deletion, even when no live route session is available.
- Distinguish RSS/key persistence failures from network validation failures.
- Show the nearest available map label in Weather instead of an internal
  location-source token.
- Enforced 44-pixel minimum phone targets for compact TODO, ordering, routing,
  and diagnostic controls.

## Fresh automated evidence

The following commands passed serially against the audited implementation:

| Check | Result |
| --- | --- |
| `npm test` | 50 files, 436 tests passed |
| `npm run typecheck` | `tsc --noEmit` passed |
| `npm run build` | 109 modules transformed; production build passed |
| `npm run test:repo` | 5 tests passed; repository copy check passed |
| `npm run test:sites` | 4 tests passed |
| `git diff --check` | Passed |
| Previously supplied ORS key scan | No tracked match |

The existing physical G2 audit remains authoritative for four-tile serial
transport, binocular output, no-queue refresh behavior, map, weather, RSS news,
TODO, routing, and black-frame hide/restore.

## Visual comparison gate

The owner-supplied Even app screenshots remain the visual source of truth.
Automated source and interaction checks cover the approved colors, card
geometry, icons, header hierarchy, and direct navigation behavior. A same-size
implementation screenshot could not be captured because the selected in-app
browser exposed no available browser backend during the final audit.

The Tailscale preview remains the current physical phone review path. Do not
mark the visual comparison as passed until the Home and at least one detail
screen are captured at matching phone dimensions and compared side by side
with the references.

## Deferred work

- Same-viewport visual capture and comparison.
- Any owner-provided pre-submission checklist.
- Version tag, GitHub Release, public package, or Even Hub submission.
- SDK `0.0.12` adoption pending resolution of the reproduced image-send
  failure.
