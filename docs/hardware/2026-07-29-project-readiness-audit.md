# Sandevistan Project Readiness Audit

Date: 2026-07-29

Target branch: `main`

Audited commit: `198722cd057e2b0c48b06cbc00fd1989fe416684`

SDK: `@evenrealities/even_hub_sdk` `0.0.11`

Overall status: `PHASE A READY`

This is the current source of truth for work remaining before release
preparation. It supersedes the 2026-07-27 completion rubric, which describes an
earlier feature branch and an older test baseline.

## Scope decision

Work proceeds in this order:

1. Complete the current `main` build's keyless physical G2 acceptance pass.
2. After that pass succeeds, validate optional OpenRouteService routing with a
   real server-side key.
3. Defer version tagging, GitHub Release creation, and Even Hub submission until
   the owner supplies a separate pre-submission checklist.

## Current automated baseline

The following checks passed serially on 2026-07-29:

| Check | Result |
| --- | --- |
| Main Vitest suite | 37 files, 374 tests passed |
| Repository policy suite | 5 tests passed; repository copy check passed |
| TypeScript | `tsc --noEmit` passed |
| Production build | 67 modules transformed |
| Sites worker suite | 4 tests passed |
| Map, news, routing, and API router suite | 24 tests passed |
| Client ORS secret scan | No `ORS_API_KEY` reference in `src`, `app.json`, or `package.json` |
| Whitespace check | `git diff --check` passed |
| Even Hub package | `sandevistan.ehpk`, 1,694,414 bytes |

Package SHA-256:

```text
819878d68364b6b444717c9870c904e5b4d6310f9a0ecd49cf5043e0a460d68c
```

## Capability status

| Capability | Software | Physical G2 | Remaining gate |
| --- | --- | --- | --- |
| Four-tile serial image transport on SDK `0.0.11` | PASS | PASS | None |
| Binocular 576×288 display | PASS | PASS | None |
| Fail-fast transport with no deferred refresh queue | PASS | PASS | Reconfirm during the final soak |
| Unchanged-tile skip | PASS | PASS, no regression | Exact identical-frame skip remains automated evidence only; not a release blocker |
| Overview clock, date, battery, weather, and map | PASS | PASS | Reconfirm together on current `main` |
| News headlines and paginated RSS body | PASS | PASS | Reconfirm page continuation during the final pass |
| TODO selection, toggle, and local persistence | PASS | PARTIAL | Reopen the app and confirm persisted completion state |
| Full-screen map and persistent zoom | PASS | PASS | Reconfirm gesture directions |
| Weather dashboard and full-screen detail deck | PASS | PENDING | Complete the Weather checklist below |
| Black-frame hide and restore | PASS | PASS | Reconfirm after the soak |
| Keyless operation without ORS | PASS | PASS | Confirm Navigation remains absent |
| ORS destination search and route lifecycle | PASS | BLOCKED | Requires Phase A pass and a real server-side key |
| SDK `0.0.12` image transport | REPRODUCED FAILURE | FAIL | Wait for an Even Realities compatibility resolution; keep `main` pinned to `0.0.11` |

## Phase A — keyless physical G2 acceptance

Status: `READY`

Use the current `main` build with SDK `0.0.11` and no `ORS_API_KEY`.

- [ ] Startup fills all four tiles and remains visible in both eyes.
- [ ] Dashboard order is `OVERVIEW → NEWS → TODO → WEATHER`.
- [ ] No Navigation page, route-key message, or destination control appears.
- [ ] Overview time, date, battery, current weather, and labelled map are legible.
- [ ] Tapping Overview opens the full-screen map.
- [ ] Map scrolling uses the approved zoom direction and preserves the selected
  zoom after returning.
- [ ] News opens a real RSS item and continues its remaining body pages before
  moving to the next article.
- [ ] TODO selection and check/uncheck work in both directions.
- [ ] After reopening the app, the TODO completion state is restored.
- [ ] Weather dashboard shows only current weather information and a large
  representative icon.
- [ ] Weather detail shows a larger icon, temperature, condition, apparent
  temperature, humidity, precipitation, and wind without overlap.
- [ ] Weather detail consumes scroll input and returns only on double tap.
- [ ] Double tap hides the HUD with black tiles and restores it without closing
  the app.
- [ ] Repeated page changes, live updates, hide/restore, and at least a
  15-minute idle period produce no deferred work burst, WebView freeze, or
  `SENDFAILED`.

Phase A passes only after the owner reports direct observations for every item.

## Phase B — real-key ORS routing

Status: `WAITING FOR PHASE A AND SERVER KEY`

Keep the key only in the server process as `ORS_API_KEY`.

- [ ] The phone exposes destination search only while routing is enabled.
- [ ] Korean destination results are returned and can be selected.
- [ ] Walking, cycling, and driving profiles return normalized routes.
- [ ] Navigation appears as the fifth page after Weather.
- [ ] Route geometry appears over both dashboard and full-screen maps.
- [ ] Live distance and maneuver guidance advance with location.
- [ ] Active guidance uses the navigation location cadence.
- [ ] Off-route fixes trigger bounded rerouting without a request queue.
- [ ] Ending guidance clears geometry and route cache and restores the general
  location cadence.
- [ ] No key value appears in the phone UI, G2 output, browser output, logs,
  client bundle, or EHPK.

## Deferred release work

Status: `DEFERRED BY OWNER`

Do not create a version tag, GitHub Release, public package, or Even Hub
submission yet. Release work begins only after a separate owner-provided
pre-submission checklist.

## Evidence

- [SDK 0.0.11 transport checkpoint](2026-07-27-sdk-0011-transport-success.md)
- [Live refresh checkpoint](2026-07-27-g2-live-refresh.md)
- [Full-screen map checkpoint](2026-07-27-g2-fullscreen-map.md)
- [Full-screen detail decks](2026-07-27-g2-fullscreen-detail-decks.md)
- [Optional ORS routing](2026-07-27-optional-ors-routing.md)
- [Weather and dynamic Navigation](2026-07-28-g2-weather-dynamic-navigation.md)
- [No-queue refresh hardening](../superpowers/specs/2026-07-28-g2-no-queue-refresh-design.md)
- [Unchanged-tile transport experiment](2026-07-28-g2-unchanged-tile-skip.md)
- [SDK 0.0.12 reproduction](2026-07-28-sdk-0012-lz4-experiment.md)
