# Ask AI Tap Interrupt Design

## Goal

Make one tap in the native Ask AI detail view immediately hand control back to
the user. A completed Realtime response that is still being paced becomes fully
visible at once. An in-progress response is cancelled, the partial text already
received becomes fully visible, and the microphone remains open for the next
turn. Assistant presentation pacing changes from 500 ms to 250 ms per Unicode
grapheme.

## Interaction Contract

- Dashboard tap still enters Ask AI and starts one session-scoped glasses
  microphone.
- A detail tap never closes the session or microphone.
- If the protocol is already `listening`, the tap flushes the presentation
  pacer to its newest authoritative snapshot.
- If the protocol is `thinking`, the tap sends one Realtime `response.cancel`
  event, freezes the authoritative response at the text already received,
  flushes that text, and locally returns to `listening` without waiting for a
  server round trip.
- Late deltas belonging to the cancelled response are ignored. The next user
  speech starts a normal new turn under semantic VAD.
- Double tap remains the only way to leave Ask AI, close the microphone, persist
  history and usage, and restore the Canvas dashboard.

## Architecture

`fast-hud-view` maps a detail tap to a dedicated `interrupt-ai` effect. The
input controller awaits `AiRuntime.interrupt()` and consumes the gesture without
running a Canvas redraw. The runtime decides whether the active response needs
Realtime cancellation, then asks the presentation pacer for one serialized
flush.

The pacer does not create a frame queue. `flush()` clears the pending timer and,
if a native text update is already in flight, waits for its acknowledgement
before emitting exactly one frame containing the newest complete target. Normal
streaming continues to reveal one grapheme only after the previous SDK update
has completed plus 250 ms.

The Realtime session exposes `cancelResponse()`. It sends `{ "type":
"response.cancel" }` only while the socket is open and the protocol has an
active generating response, then retires that response locally so late output
events cannot re-enter the visible turn. This follows OpenAI's documented
WebSocket interruption mechanism while avoiding audio truncation because this
application requests text-only model output and performs no assistant audio
playback.

## Failure Handling

Cancellation is best-effort. A closed socket or send failure does not close the
microphone or leave the detail page; the runtime still flushes the partial text
and returns the local presentation to listening. A flush is serialized behind
any in-flight native update, preventing overlapping `textContainerUpgrade`
calls.

## Verification

- Reducer and controller tests prove one tap triggers interruption without
  stopping the session or restoring Canvas.
- Session tests prove `response.cancel` is sent once and late deltas for the
  retired response are ignored.
- Pacer tests prove 250 ms grapheme cadence and a single acknowledgement-safe
  flush.
- Runtime tests cover completed-response flush and generating-response cancel,
  partial reveal, and listening recovery.
- The complete test suite and production build must pass before publishing.
