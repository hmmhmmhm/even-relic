# G2 HUD Project Completion Rubric

Date: 2026-07-27

Target branch: `feature/g2-ors-routing`

> [!NOTE]
> This historical rubric has been superseded by the
> [2026-07-29 project readiness audit](2026-07-29-project-readiness-audit.md),
> which tracks the current `main` branch, Weather page, 374-test baseline, and
> the owner-approved order of remaining work.

This document links the product requirements finalized in the conversation with the current level of verification.
The most up-to-date link to each item in this document rather than the incomplete checkbox in past experiment documents.
Prioritize checkpoints.

The meaning of the status is as follows.

- `PASS`: Automatic verification and required actual G2 confirmation completed.
- `SOFTWARE PASS`: Implementation and automatic verification have been completed, but the actual G2 confirmation of the build remains.
- `OPTIONAL`: This is an optional feature and requires external credentials for actual verification.

## Product Requirements

| Requirements | status | Evidence |
| --- | --- | --- |
| 1-bit BMP four-tile serial transmission in SDK `0.0.11` | PASS | Initial transfer and SDK checkpoint |
| Binocular 576×288 maximum display area | PASS | Maximum Area and Live Update Checkpoints |
| Quick transition of `OVERVIEW → NEWS → TODO → NAVIGATION` | PASS | Live Update Checkpoints |
| Time in minutes, year, month, day, day of the week | PASS | Live Update Checkpoints |
| Battery status of a single connected G2 or R1 | PASS | Live Update Checkpoints |
| Keyless current location and Open-Meteo weather | PASS | Live Data Checkpoint |
| SBS RSS News Up to six titles | PASS | Live Data Checkpoint |
| OSM roads and 1.5x place name labels, updated when moving | PASS | OSM Label and Live Refresh Checkpoints |
| Double tap to black screen and restore | PASS | Live Update Checkpoints |
| Tap once to enter full screen map | SOFTWARE PASS | Full screen map checkpoint |
| Scroll zoom, hold zoom, double tap to return to dashboard | SOFTWARE PASS | Full screen map checkpoint |
| News detailed deck that reads the RSS title, summary, and publication time one by one | SOFTWARE PASS | Full screen detailed deck checkpoint |
| TODO detailed deck with support for selection, completion transitions, and local saving | SOFTWARE PASS | Full screen detailed deck checkpoint |
| Navigation detail deck supporting route motion navigation and current motion return | SOFTWARE PASS | Full screen detailed deck checkpoint |
| Detailed screen boundary input consumption and four-tile serial transmission | SOFTWARE PASS | Full screen detailed deck checkpoint |
| All general functions operate even without ORS | SOFTWARE PASS | Keyless runtime inspection of optional ORS checkpoints |
| ORS destination search, route display, re-search and exit | OPTIONAL | Implementation and mock API verification completed, waiting for real key and G2 confirmation |

## Automatic verification baseline

The current ORS integration branch has passed the following verifications serially:

- `npm test`: 31 files, 308 tests
- `npm run typecheck`
- `npm run build`: Convert 60 modules
- `npm run test:sites`: 4 tests
- API router, maps, news, route tests: 24 tests
- No access to `ORS_API_KEY` in client source.
- `git diff --check`

## Remaining real device gates

1. Enter the map, news, TODO, and navigation detail screens at `detail-decks-019`.
   Both eyes check four tiles, scroll, tap, double tap and return.
2. After changing TODO, open the app again and check whether the saved state is restored.
3. Check for black screen conversion and restoration, general page conversion, and absence of `SENDFAILED`.
4. In a state where there is no key, check the maintenance of existing functions and the ‘path key required’ status.
5. Once you receive the ORS key, you can search for the actual destination and receive route guidance through separate selection verification.
   Confirm. Key values ​​are recorded only in server environment variables.

Full screen detailed deck and Mookie ORS will not be implemented until the actual G2 is confirmed.
Do not push the branch to the default branch or mark it as complete.

## Connected checkpoint

- [First G2 image transmission successful](2026-07-26-first-g2-image-success.md)
- [SDK 0.0.11 transport successful](2026-07-27-sdk-0011-transport-success.md)
- [Real-time clock, battery, moving map](2026-07-27-g2-live-refresh.md)
- [OSM place name readability](2026-07-27-balanced-osm-labels.md)
- [Fullscreen Map](2026-07-27-g2-fullscreen-map.md)
- [Fullscreen Detail Decks](2026-07-27-g2-fullscreen-detail-decks.md)
- [Optional ORS routing](2026-07-27-optional-ors-routing.md)
