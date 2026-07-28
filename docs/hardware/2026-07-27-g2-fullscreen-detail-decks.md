# G2 full screen detailed deck checkpoint

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

Date: 2026-07-27

SDK: `0.0.11`

Build: `detail-decks-019`

Result: `PENDING`

branch: `feature/g2-ors-routing`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=detail-decks-019`

## Implementation scope

- Single tap on `OVERVIEW`: existing full screen map and five levels that remain throughout the session
  zoom
- One tap on ‘NEWS’: Title, refined summary, and publication of one actual SBS RSS article
  visual indication
- `TODO` single tap: complete checklist of up to six items, highlight selections, complete status
  conversion
- Save TODO changes to `relic:todos:v1` and restore them in the next app session
- Tap once on `NAVIGATION`: ORS path movement one step, movement distance, total remaining distance,
  Indication of current operation
- Detailed screen scroll border input consumption and quick double tap return to dashboard
- Four tiles ‘3 → 5 → 2 → 4’ are transmitted only when the visible detailed data changes.
- Suppress transmission of invisible changes such as weather, battery, and minute-by-minute time in the detailed screen

## Automatic verification

- `npm test`: 31 files, 308 tests passed
- `npm run typecheck`: Passed
- `npm run build`: Convert 60 modules
- `npm run test:sites`: 4 tests passed
- API Router, Maps, News, Routes: Passed 24 tests
- Client `ORS_API_KEY` references: 0
- All implementation files: 450 lines or less
- `git diff --check`: passed

## Actual G2 Check Items

- [ ] All four 576×288 tiles are visible from both eyes.
- [ ] In `OVERVIEW`, entering the map, zooming in, zooming out, maintaining zoom, and returning work.
- [ ] In `NEWS`, you can read the article title and summary and move to the previous or next article.
- [ ] Item selection and completion transition work in `TODO`.
- [ ] Re-open the app and the TODO completion status is restored.
- [ ] In `NAVIGATION`, the no path or no key state and the path action deck are
  Looks correct.
- [ ] Does not jump to the dashboard page from the list or zoom border of each detail screen
  No.
- [ ] If you quickly tap twice on the details screen, you will return to the dashboard page you entered.
- [ ] If you quickly tap twice on the dashboard, the screen will change to a black screen and then be restored.
- [ ] `SENDFAILED` does not occur during the entire test.

## Gate

After charging the glasses and before actually checking the above items, the basic branch integration, remote
Push and completion notifications are not processed. `Result` in this document is also before actual observation.
Keep it as `PENDING`.
