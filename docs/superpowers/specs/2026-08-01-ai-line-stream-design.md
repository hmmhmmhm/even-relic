# Ask AI Line Stream Design

## Goal

Make the native Ask AI detail view read like a plain, live transcript rather
than a custom dashboard. The glasses should show recognized speech
immediately, reveal assistant text at a stable human-readable cadence, and
move through history one wrapped line at a time.

## Approved interaction

- Remove the Ask AI title, phase header, frame, counters, page labels, and
  footer instructions from the detail view.
- Before speech exists, show only the active locale's short `Listening…`
  message. Configuration and runtime errors remain visible because they are
  actionable.
- Keep recognized user speech authoritative and immediate.
- Buffer the assistant's authoritative Realtime text and expose one Unicode
  grapheme every 100 ms. New upstream deltas replace the pending target rather
  than forming a replay queue.
- Wrap the chronological transcript into individual lines. The latest view
  follows the newest line automatically; each scroll gesture moves the
  selected end line by exactly one line. There is no transcript page model or
  page counter.
- Let wrapped transcript text use the full native container width. Insert one
  blank display row at a speaker transition, but do not include that row in
  the semantic transcript or make it a scroll target.
- A normal tap remains a no-op. Double tap remains the only exit and still
  stops the microphone/session before restoring the Canvas dashboard.

## Presentation and transport

This follows the buffering model of Vercel AI SDK `smoothStream`: upstream
generation remains unthrottled while presentation releases bounded chunks at
a configured delay. Sandevistan already receives OpenAI Realtime events over
its own WebSocket, so importing the full Vercel AI SDK only for this transform
would duplicate transport code and increase the WebView bundle. A small local
grapheme pacer provides the same relevant behavior.

The 100 ms clock is a presentation clock, not an SDK call queue. Native
`textContainerUpgrade` remains sampled/latest-wins so slow bridge calls cannot
build a backlog or freeze the WebView. On hardware, one native update may
therefore contain several already-paced graphemes, but the authoritative
conversation and visible ordering remain correct.

## Data model

- Replace `transcriptPages` with `transcriptLines` on `AiHudSnapshot`.
- Replace the detail view's `aiPage`/`aiPageCount` state with
  `aiLine`/`aiLineCount` while retaining `aiFollowsLatest`.
- Build role-prefixed wrapped lines once, then localize only the role prefixes.
- Native Text and Canvas fallback views select a rolling viewport ending at
  `aiLine`; the native view reserves one final line for `Listening…` only when
  the latest transcript is selected and the runtime is listening.

## Verification

- Fake-timer tests prove one grapheme per 100 ms, including composed emoji.
- Transcript tests prove chronological line output without six-line pages.
- View reducer tests prove one-line scroll and latest-follow behavior.
- Native and Canvas tests prove the decorative UI is absent and localized
  listening/transcript content remains.
- Run the complete unit suite, typecheck/build, package build, and Sites worker
  tests before promotion.
