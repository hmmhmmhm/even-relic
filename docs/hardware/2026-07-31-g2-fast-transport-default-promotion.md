# G2 Fast Transport Default Promotion

Date: 2026-07-31

Status: Ready for default-route physical gate

Branch: `experiment/g2-pipelined-transport`

## Goal

Validate the query-free fast route after promoting the physically measured
four-call SDK pipeline and four-level content palette to defaults. Confirm that
solid-black hide frames now bypass palette conversion without changing the
proven no-queue, fail-fast transport behavior.

## Default

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040
```

Missing or invalid performance parameters resolve to four in-flight image
calls and the `hud-4` transmitted palette.

## Rollback

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&levels=original&build=rollback-serial-original-040
```

This route preserves a complete serial/original comparison without changing
source or SDK version.

## Prior physical evidence

The preceding palette comparison on the same four-call pipeline recorded:

| Metric | Original palette | Four-level palette | Change |
| --- | ---: | ---: | ---: |
| Full HUD PNG bytes | 50,031 | 22,821 median | 54.4% lower |
| Complete restore | 2,468 ms median, n=4 | 1,855 ms median, n=8 | 24.8% faster |

No `sendFailed` or timeout appeared in the supplied comparison trace. The
generated black frame remained 4,704 bytes in both modes, so this revision
routes that frame through the original encoder and avoids the redundant
palette pass.

## Required physical evidence

Run only one route at a time. On the default route:

1. Confirm startup renders all four quadrants in both eyes.
2. Repeat at least five hide and restore cycles.
3. Confirm content encodes report `palette hud-4`.
4. Confirm hide encodes report `palette original`.
5. Confirm each four-tile refresh starts with up to four in-flight SDK calls.
6. Record content and black PNG byte totals plus complete-refresh durations.
7. Confirm clock, weather, map labels, news body, and TODO text remain legible.
8. Record any missing tile, persistent tearing, timeout, or `sendFailed`.
9. Leave the WebView idle, then confirm double-tap and scroll remain responsive.
10. Confirm input received while busy is dropped and is not replayed later.

The default route passes only if binocular output and content remain correct,
hide and restore remain reliable, no queue accumulates, and post-idle input
stays responsive. The hide-bypass path remains physically unpassed until this
evidence is supplied.

## Automated gate

- Vitest: 57 files, 511 tests passed serially.
- TypeScript: passed.
- Repository copy checks: 5 passed serially.
- Production and Sites builds: passed.
- Sites worker tests: 4 passed serially.
- Even Hub package: `sandevistan.ehpk`, SDK `0.0.11`.

## Integration rule

Keep this change on `experiment/g2-pipelined-transport` until the query-free
default route passes the physical gate. Fast-forward `main` only after that
result is recorded.
