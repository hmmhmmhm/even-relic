# G2 Weather detailed/dynamic navigation page design

Date: 2026-07-28

Status: User approved

## Target

In G2's basic page configuration, weather that operates without a key is provided as an independent page.
Users without ORS keys will not see instructions for disabling functions or key settings, and will currently
Only weather information should be quickly readable with large letters and high contrast.

## Page composition

Uses a dynamic page list that only applies to Fast Canvas HUD.

- ORS disabled: `Overview → News → TODO → Weather`
- ORS active: `Overview → News → TODO → Weather → Navigation`

Weather always comes fourth. Navigation only works when `route.status !== "disabled"`
It appears as the last page. The denominator of the page number also matches the current list length.
Displayed as `04 / 04` or `05 / 05`.

The fixed page type and order of the general Canvas and existing Hybrid experiment paths are not changed.
No. Fast Canvas has a dedicated page type and list calculation function to limit the scope of change.
Isolate.

## Weather Dashboard Page

The left map and common clock header maintain the existing Fast Canvas structure. fourth
The area on the right side of the page is used only for weather information.

- Status label: `WEATHER // NOW` or `WEATHER // LAST` for old cache.
- Biggest information: current temperature and weather conditions
- Secondary information: perceived temperature, humidity, probability of precipitation, wind
- No data: `WEATHER DATA UNAVAILABLE` without keys or setup instructions
- Loading data: `WEATHER LOADING`

Battery, news, TODO, and navigation text are not mixed into the weather page.

## Weather details page

One tap on the weather dashboard page for 576×288 full screen weather details.
Enter. The detailed screen focuses on the currently available Open-Meteo observations.

- Top: `WEATHER // LIVE`, `WEATHER // LAST`, `WEATHER // LOADING`,
  `WEATHER // UNAVAILABLE`
- Center: The current temperature is the largest, next to it is the weather condition.
- Bottom information block: perceived temperature, humidity, probability of precipitation, wind
- Only when the cache is old, a short `LAST DATA` is displayed instead of the update time.
- Scroll and single tab only consume and do not move to another page
- A quick double tap returns to the original dashboard weather page

At this stage, no new hourly or daily forecasts are requested. existing
Open-Meteo uses only current weather data to change network and cache models and to use glasses
Avoid information overload.

## ORS Disabled Handling

If `route.status === "disabled"`, the navigation page is removed from the circular list.
Exclude. Therefore, the text below is not displayed on both the dashboard and detail screen.

- `path key required`
- `Use after connecting ORS`
- `Key setting required`
- `NAV // DISABLED`

If the page list changes during runtime and the current page no longer exists,
Normalize to the weather page. When ORS is activated, navigation follows weather.
It is added automatically, but does not force the user's current page to change.

## Input and status

Add weather detail mode to `FastHudViewMode`. The dashboard weather page tab is
This mode is entered and no additional state such as selection index is created.

The latest separation rules for normal page orientation and map zoom orientation are maintained. weather details
`consume` all scrolling, so scrolling becomes a dashboard page transition
It doesn't spread.

## Real-time update

When a weather detail is open, the weather state, current observation, or `fetchedAt` is
If something changes, all four tiles are updated once. If the values ​​are the same, they are not updated.
Existing “discard busy request, no queue, on failure leave to next independent event” rule.
Just follow it.

The dashboard weather page uses the existing right area update path.

## Review options

1. Dynamic Page 4 of 5: Completely hide inactive functions when no key is present and keep the weather always on.
   Put it in fourth place. This is a user-approved plan.
2. Fixed page 5: Leave the navigation page but display it as a blank screen. The order is
   Simple but meaningless pages remained and were excluded.
3. Add time-based forecast: Although information increases, API response, verification, cache, and details are added.
   Page movement became complicated, so it was excluded from the current scope.

## Test

Automated testing verifies:

- When ORS is disabled, page 4 and `Weather` are the fourth order.
- When ORS is activated, `Navigation` is added as the fifth
- Dynamic page numbers and two-way circulation
- Inactive ORS notice does not exist in Fast Canvas results
- Weather dashboard displays only weather information
- fresh, stale, loading, unavailable status of weather details
- Weather details tab/scroll consumption and double tap return
- Full details updated when weather value changes, no update when the value is the same
- No regression in map zoom and general page orientation rules.

Automated verification runs all tests serially. In fact, in G2, four tiles on both sides,
Check font size, page order, entering and returning to details, and long-term input response.

## Completion conditions

- In the default keyless environment, the fourth thing is the weather and there is no navigation guidance at all.
- Navigation appears fifth only in keyed environments
- Five current weather information are clearly readable in weather details
- Existing maps, news, TODO, and hide/restore operations are maintained.
- Automatic serial verification and remote push only after passing actual G2 checkpoints
