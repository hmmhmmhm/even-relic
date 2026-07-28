# G2 Weather detailed/dynamic navigation checkpoint

Date: 2026-07-28

SDK: `0.0.11`

Build: `weather-icon-029`

Result: `PENDING`

branch: `feature/g2-ors-routing`

Implementation commit: `ccd4116`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=weather-icon-029`

## Implementation scope

- The default page when ORS is inactive is configured as ‘Overview → News → TODO → Weather’
- Navigation added as fifth after Weather only when ORS is active
- Normalize inactive Navigation page requests to Weather
- Display page numbers as `04 / 04` or `05 / 05` according to the current list
- Removed route key, ORS connection, and key setup instructions from Fast Canvas in keyless state.
- Weather dashboard displays only current temperature, conditions, feeling, humidity, probability of precipitation, and wind
- Access weather details on 576×288 full screen with Weather tab
- Weather details display current temperature 48px and four auxiliary indicators in 2×2
- Displays fresh, stale, loading, and unavailable status with weather-specific phrases
- Consumes tab and scrolling of weather details and only uses double tap to return to dashboard
- Updates all four tiles only when weather display changes when Weather details are open
- Convert current weather codes to 1-bit geometries for sun, clouds, fog, rain, snow, and thunderstorms
- Approximately 72px representative weather icon displayed on Weather dashboard
- Weather Displays approximately 104px representative weather icon in full screen details
- In the loading and unavailable states, the icon is not displayed to prevent misunderstanding.
- No existing queues, discard busy requests, maintain tile timeout and independent input rules after failure.

## Automatic verification

The commands below were executed in order rather than simultaneously.

- `npm test`: 37 files, 371 tests passed
- `node --test --test-concurrency=1 tests/*.test.mjs`: Passed 28 tests
- `npm run typecheck`: Passed
- `npm run build`: Converted 67 modules, passed production build.

Automated tests include dynamic 4/5 page ordering and rotation, navigation normalization, and weather.
All data status in dashboard/detail, detailed input isolation, weather change based overall
Verify updates. Map zoom direction and general page direction, news body page,
TODO re-toggle, hide/restore transfer regression also passed.
Code mapping of representative icons, path coordinate boundaries, dashboard/detailed size and empty state
Even non-printed output is automatically verified.

## Actual G2 Check Items

- Without the [ ] key, only four pages cycle: Overview → News → TODO → Weather.
- The [ ] key required or ORS information does not appear on the glasses.
- [ ] Weather Only weather information appears on the dashboard.
- [ ] On the Weather dashboard, you can see a large 1-bit icon indicating the current condition.
- [ ] Go to the full screen details using the Weather tab.
- [ ] Weather details show a representative icon that is larger than the dashboard.
- The [ ] icon and the temperature/status/indicator letters do not overlap.
- [ ] The current temperature, conditions, feeling, humidity, precipitation, and wind can be read clearly.
- [ ] In stale state, `WEATHER // LAST` and `LAST DATA` are displayed.
- [ ] Weather detail scrolling does not change the page, but double tapping returns.
- [ ] In an ORS active environment, Navigation is added as the fifth.
- [ ] The map zoom direction and general page direction remain in the previously approved state.
- [ ] Moving news text, checking/unchecking TODO, and hiding/restoring HUD continue to respond.
- [ ] Even if it is turned on for a long time, weather updates or input requests do not accumulate.

## Gate

Remote push and completion notification will not be processed until the actual G2 items above are confirmed.
After receiving direct observation results, update `Result` and check items in this document.
