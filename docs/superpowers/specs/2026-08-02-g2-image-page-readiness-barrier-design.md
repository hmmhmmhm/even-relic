# G2 Image Page Readiness Barrier Design

Date: 2026-08-02

Status: Rejected by physical G2 evidence

## Goal

Test whether a general page-readiness delay prevents intermittent missing
quadrants, one-sided output, and fully absent HUD frames when every SDK image
call reports success.

## Evidence and cause

Physical logs on SDK `0.0.13` showed successful serial sends for IDs 3, 5, 2,
and 4 while the optical output remained incomplete. The candidate added a
200 ms wait after startup page creation and blank-display image-page rebuild.
Repeated physical cycles still produced the same one-sided and fully absent
output.

The result rejects insufficient page-settle time as the general HUD cause.
The regression instead correlates with promotion of pipeline one: the previous
four-call default had completed its physical gate without this reported
integrity regression.

## Behavior

The rejected general wait is removed. Query-free startup and blank-display
restoration use the hardware-proven four-call default without an added delay.
Pipeline one remains available only through an explicit diagnostic query.

The 200 ms barrier remains narrowly scoped to Ask AI exit because that path
performs two consecutive rebuilds: native Text to the neutral event page, then
the neutral page to the five-container Canvas page. It now separates those two
rebuilds; the rejected post-image-rebuild wait is not retained.

## Diagnostics and verification

The accepted main route must log `pipeline 4`, start IDs 3/5/2/4 with an
in-flight limit of four, and omit general `initial image page ready` and
`restore image page ready` diagnostics. Native Ask AI exit instead logs
`native AI neutral page ready · 200ms` before rebuilding the image page.
