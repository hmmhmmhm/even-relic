# G2 full screen detailed deck design

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

Date: 2026-07-27

Target path: `/hud-canvas-fast`

Base branch: `feature/g2-ors-routing`

Status: APPROVED

## Target

Four dashboard tabs can be physically navigated and manipulated from a simple summary screen.
Expand with detailed functions. In the same way as the full screen map in `OVERVIEW`
Tap once on `NEWS`, `TODO`, and `NAVIGATION` to full screen in 576×288
Open.

Contracts that have already been confirmed by G2 will not be changed.

- SDK `0.0.11`
- Four 288×144 image containers
- Total transmission order `3 → 5 → 2 → 4`
- Dashboard conversion order `OVERVIEW → NEWS → TODO → NAVIGATION`
- Serial execution of all image updates
- Toggle showing black screen on double tap in dashboard

## Selected access

Use a dedicated full-screen deck for each page.

- The map maintains the existing zoom deck.
- News is created by reading actual RSS articles one at a time.
- TODO creates a selectable full-screen checklist.
- Navigation is made with a deck that checks the route operation step by step.

The existing method of enlarging only the right column is simple to implement, but it is difficult to consume actual content and
It is difficult to operate. The method of displaying the original article webpage directly on the glasses is delayed,
Do not use because readability, external HTML safety, and copyright scope are unclear.
The news details screen currently uses only the titles and summaries provided by allowlist RSS.

## Common screen states

Extends the current map-only state to the next common state.

```ts
type FastHudViewMode =
  | "dashboard"
  | "map"
  | "news"
  | "todo"
  | "navigation";

type FastHudViewState = {
  readonly mode: FastHudViewMode;
  readonly zoomIndex: number;
  readonly newsIndex: number;
  readonly todoIndex: number;
  readonly navigationIndex: number;
  readonly navigationFollowsActive: boolean;
};
```

The selection state is maintained throughout the app session. Go to the dashboard page or
Even if you close the screen, the map zoom and the last selected location of each detailed deck remain. app
When restarting, the map is 650m away, and each deck moves to either the first item or the current path action.
Initialize.

The input transition function returns the current state, dashboard page, number of items, and current path behavior.
Receives and returns the next status and one of the following results:

- `unhandled`: Overrides existing dashboard toggle or black screen toggle.
- `consume`: Consumes only input without changing the screen or transmission.
- `redraw`: Redraw the current Canvas and transfer four tiles
- `toggle-todo`: Session task request to change the selected TODO

## Gesture contract

### Dashboard

- Tap once: Enter the full-screen detailed deck corresponding to the current tab.
- Scroll down: Next dashboard tab
- Scroll up: Previous dashboard tab
- Quickly double tap: Toggle display of traditional black screen

### All detailed decks

- Quickly double tap: Return to the dashboard tab you entered
- Scrolling border on detail deck: consumes input and does not advance to dashboard tab
- Black screen toggle does not work while the details screen is open.

### Map

- Scroll down: zoom in one level
- Scroll up: zoom out one step
- Single tap: consumes only input

### News

- Scroll down: Next article
- Scroll up: Previous article
- Single tap: consumes only input

### TODO

- Scroll down: select next item
- Scroll up: select previous item
- Single tap: toggle completion status of selected item

### Navigation

- Select currently active action when entering
- Scroll down: Next path action
- Scroll up: previous path action
- Single tap: Instantly return to currently active action

## News data

Add optional `summary` to `NewsItem`.

```ts
type NewsItem = {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly url?: string;
  readonly publishedAt?: number;
};
```

RSS `<description>`'s HTML is converted to text with `DOMParser` and spaces are normalized.
Control characters are removed and only up to 360 code points are stored. Original article
URLs preserve only verified HTTP or HTTPS addresses as before, but directly from G2.
It doesn't open. Cache verification and replication also include `summary`.

Full screen news displays the following information:

- `NEWS // LIVE`, `STALE`, `LOADING`, `UNAVAILABLE` status
- Current location `1 / 6`
- Large title of up to two lines
- Summary of up to five lines
- Date and time of publication
- `SCROLL // ARTICLES`, `DOUBLE TAP // BACK` information

When new RSS results arrive, the existing selection index is limited to the valid range. the result
If empty, only status information is displayed and scrolling is consumed.

## TODO data and persistence

Add the following model to `LiveDashboardState`.

```ts
type TodoItem = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

type LiveDashboardState = {
  // Existing location, weather, news, map, route
  readonly todos: DataState<readonly TodoItem[]>;
};
```

The initial items remain at the three currently approved.

1. Go to the subway station
2. Bring an umbrella
3. Check the route

Even stores up to six items in `relic:todos:v1` in local storage. Each title is
Must be 1 to 40 code points with spaces normalized. If the cache is missing or corrupted, the initial
Use the item. This scope includes a phone UI for adding, deleting, and name editing items.
Does not include

A single tap first changes the memory state, puts the transfer request into the serial queue, and then
Try saving. Four tiles since the save ends or fails and then ends the input operation.
Transfer and storage operations do not overlap. A save failure will result in changes to the current session.
It doesn't revert, but restarting the app may restore the last saved state.
there is.

Full screen TODO displays all items, current selection, checkboxes, completed count and next
Display guidance.

```text
SCROLL // SELECT · TAP // TOGGLE · DOUBLE TAP // BACK
```

## Navigation details

If there is an active route, it displays:

- Destination and total remaining distance
- Selected action number and total number of actions
- Selected ORS directive
- Distance of the movement
- Show currently active actions
- Guide to scrolling and returning to current action

Before the user directly navigates to a path action, selectivity also changes when the active action changes.
Follow. Scroll even once to retain the selection, and tap once to return to the current selection.
Follow the movements.

If the path state is `disabled`, `loading`, `stale`, or `fresh` but there is no value,
Each state and the required actions on the phone are displayed in large letters. Search for destinations in glasses,
Path start or end is not included in this scope.

## Rendering

The three detailed renderers reuse common Canvas colors and text tools, but
Separate by responsibility. All implementation files are kept to 450 lines or less.

- Black background
- Key information `#ffffff`
- Supporting information `#d0d0d0`
- Rescue vessel and deactivation information `#808080`
- No shadow and glow effects
- Header and footer are black opaque bands
- The text uses open corner frames and ample white space.

Long Korean strings are code point based, not dependent on Canvas measures
Cut it with a line break and add an ellipsis to the last line. This method uses a test canvas and
Create the same line configuration in the actual WebView.

## Live updates and transfers

The dashboard maintains the existing `left`, `right`, `right-top`, and `all` forwarding rules.
In the detailed deck, the four tiles are updated only when the visible content actually changes.

- Map: change location, map or route shown on map
- News: Changes in news status, article list, title, summary or publication time
- TODO: Change of item or completion status
- Navigation: route status, current motion or distance changes

Clock, battery, weather or data from other pages not visible on the details screen
Changes only preserve the state and do not send images. Enter the details screen, move items,
TODO changes and returns are sent in the entire order of `3 → 5 → 2 → 4` in the existing serial queue.

TODO changes do not overlap storage and image transfer during input processing. session state
The change queues the transfer request and retrieves the most recent four tiles after the current input operation has finished.
Send.

## Failure and boundary handling

- If there is no RSS summary, the title and ‘No summary’ are displayed.
- If the news is being updated or fails, the existing `loading`, `stale`, `unavailable`
  Use the status as is.
- If the TODO cache is damaged, it is restored to the initial three items.
- Failure to save TODO does not prevent image transfer or subsequent input.
- The navigation details screen opens even if there is no route or ORS is disabled.
- When an item disappears or the number of path operations decreases, the selection position is limited to the effective range.
- All border scrolls are consumed without transfer.
- Image transmission failure uses the existing error indication and allows the next queue operation.

## Exclude range

- Open the original article webpage in G2
- Crawl article text not provided by RSS
- Add, delete or edit TODO items
- Search for destinations, start or end route from glasses
- Voice input and notification push
- SDK `0.0.12` or LZ4 transfer

## Verification

All tests are run serially.

1. Pure state transition testing for all entry, return, selection moves, boundary exhaustion, TODO
   Check the effect and navigation rearrangement.
2. RSS tests for summary cleansing, length limits, cache validation, and retention of old data.
   Confirm.
3. TODO test to check default value, healthy cache, corrupted cache, toggle and save failure.
   Confirm.
4. Renderer test shows 576×288 output of four detailed screens, line breaks, status text,
   Check the check mark and gesture instructions.
5. App test, live update filter by detailed mode, transfer all, TODO toggle,
   Make sure to return to the latest status.
6. As a transfer test, all detailed inputs use the same serial queue and at the boundary
   Make sure images are not being transmitted.
7. Full Vitest, type checking, production build, Sites, server API and
   Passes `git diff --check`.

## Actual G2 checkpoint

Existing full-screen map gates and detailed decks in series in one new build
Verify.

- One-tap access to all four pages of the dashboard
- News title, summary, publication time and previous/next article
- TODO selection, check transition and maintenance after re-entry
- Active or inactive navigation detail status
- Double tap return to all detail screens
- Toggle display of black screen in dashboard
- Four tiles on both sides and normal page order
- `SENDFAILED` does not occur

The default branch integration and push are not marked as complete until the actual glasses are confirmed.
