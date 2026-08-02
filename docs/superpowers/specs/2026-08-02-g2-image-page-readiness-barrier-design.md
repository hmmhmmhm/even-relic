# G2 Image Page Readiness Barrier Design

Date: 2026-08-02

Status: Approved from physical G2 evidence

## Goal

Prevent intermittent missing quadrants, one-sided output, and fully absent HUD
frames even when every SDK image call reports success.

## Evidence and cause

Physical logs on SDK `0.0.13` show successful serial sends for IDs 3, 5, 2,
and 4, but the optical output can remain incomplete. The affected transitions
start encoding and sending immediately after startup page creation or a
blank-display image-page rebuild. The already stabilized Ask AI exit path waits
200 ms at the same boundary and restores complete binocular output.

`updateImageRawData` success therefore confirms SDK request acceptance, not
that every newly rebuilt image container is ready in both optical outputs.

## Behavior

After successful startup page creation, an existing-page fallback rebuild, or
a blank-display image-page restore rebuild:

1. wait 200 ms;
2. encode the requested frame;
3. send the established IDs 3, 5, 2, and 4 with the production serial limit;
4. commit visibility only after every image call succeeds.

Blank hiding remains an immediate one-container rebuild and adds no wait.
Paging, input redraws, and live refreshes reuse the installed image page and add
no wait. The change does not add retries, concurrent calls, forced resends, or
new SDK containers.

## Diagnostics and verification

Startup logs `initial image page ready · 200ms`; normal restoration logs
`restore image page ready · 200ms`. Transport tests assert that each readiness
barrier occurs before encoding and before the first image call. Existing tests
continue to prove one image call at a time and the 3/5/2/4 order.
