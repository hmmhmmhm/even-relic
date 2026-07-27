# G2 Optional ORS Routing Checkpoint

Date: 2026-07-27  
Branch: `feature/g2-ors-routing`  
Server API commit:
`d0dcef6aeb7132685ce6824a8b219a4ae6319d2d`  
Client and G2 commit:
`003d318f800d5223dbfa7a32a20cd32c3a47989b`

## Scope

All existing location, weather, RSS, OSM, paging, fullscreen-map, zoom,
bilateral image, and black-frame behaviors remain keyless. Only destination
search and route calculation depend on OpenRouteService.

The key is read only as the server process secret `ORS_API_KEY`. It is not a
Vite variable and must not appear in `src/`, `app.json`, `package.json`, an
EHPK, a query string returned to the client, logs, screenshots, or this
document.

## Implemented behavior

- `GET /api/routing-status` reports only `{ enabled }`.
- Missing key:
  - phone UI shows no destination input;
  - navigation page shows `NAV // READY`, `경로 키 필요`;
  - `/api/geocode` and `/api/route` return `ROUTING_DISABLED`;
  - keyless providers continue normally.
- Configured key:
  - phone UI searches up to five Korean destinations;
  - route profiles are restricted to walking, cycling, and driving;
  - only normalized coordinates, route geometry, distance, duration, and
    maneuvers reach the client;
  - G2 navigation shows ready, routing, active, or stale state;
  - the active route is drawn over OSM roads in embedded and fullscreen maps.
- Location:
  - general map rate: medium accuracy, `15 s / 15 m`;
  - active route rate: medium accuracy, `2 s / 5 m`;
  - route end restores the general rate.
- Refresh:
  - right tiles change only for a maneuver or displayed-distance bucket;
  - left tiles change after meaningful movement or a new map cell;
  - simultaneous left and right changes become one `all` refresh;
  - three consecutive fixes over `35 m` off-route can reroute;
  - rerouting has a `30 s` cooldown and one in-flight request.
- Persistence:
  - the newest route and destination are retained for at most six hours;
  - restoration is stale and does not silently resume navigation;
  - the phone exposes retry and end actions;
  - ending clears the route cache;
  - late start or reroute responses cannot undo an explicit end.

## Automated evidence

Run serially:

```text
npm test
  26 files passed
  264 tests passed

npm run typecheck
  passed

npm run build
  53 modules transformed
  Sites server modules prepared

npm run test:sites
  4 tests passed

node --test --test-concurrency=1 \
  tests/api-router.test.mjs \
  tests/map-api.test.mjs \
  tests/news-api.test.mjs \
  tests/route-api.test.mjs
  24 tests passed
```

`git grep -n "ORS_API_KEY" -- src app.json package.json` returns no client
matches.

## Current physical gate

The existing fullscreen-map build remains isolated and running at:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fullscreen-map-018
```

Its pending observation must be completed before replacing that server with
this ORS build.

## No-key hardware checklist

Status: PENDING

- [ ] bilateral four-tile startup remains visible;
- [ ] overview weather, RSS, OSM, fullscreen map, and zoom remain live;
- [ ] navigation page shows only the key-required state;
- [ ] phone UI shows no destination input;
- [ ] paging and double-tap display toggle remain unchanged.

## Real-key hardware checklist

Status: BLOCKED UNTIL A USER-PROVIDED KEY IS SET IN THE SERVER PROCESS

Start the future test process with the key only in its environment. Never put
the value in the command history copied into documentation.

- [ ] phone status exposes destination search;
- [ ] Korean results appear and one can be selected;
- [ ] chosen walking/cycling/driving route appears over the map;
- [ ] navigation tab shows live distance and maneuver;
- [ ] navigation switches to `2 s / 5 m`;
- [ ] ordinary fixes do not produce redundant image sends;
- [ ] route end removes geometry, clears cache, and restores `15 s / 15 m`;
- [ ] no secret appears in the phone, G2, browser output, or logs.
