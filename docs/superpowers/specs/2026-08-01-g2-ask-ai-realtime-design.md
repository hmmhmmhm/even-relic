# G2 Ask AI Realtime HUD Design

## Goal

Add an optional Ask AI page to the proven SDK 0.0.13 fast HUD. A user can see
recent conversation excerpts and this app's estimated Realtime spend on the
dashboard, then deliberately tap the page to start a new continuous voice
conversation. The G2 microphone supplies audio and the glasses show streaming
user transcription and assistant text. No speaker or model audio output is
used.

## Product behavior

- Ask AI participates in the existing configurable circular HUD page order.
- The dashboard page is passive. It may render the three latest local excerpts
  and weekly/monthly estimated cost, but it does not open a microphone or
  network session.
- A dashboard tap opens the full-screen AI deck and begins a fresh Realtime
  session using the G2 microphone.
- Semantic VAD owns speech start, speech stop, response creation, and
  interruption. The user does not press-to-talk.
- The detail deck shows a concise state label, the latest user transcript, the
  streaming assistant response, and a position indicator for older transcript
  pages.
- Scroll browses completed transcript pages. Tap pauses or resumes listening.
  Double tap leaves the deck, stops the G2 microphone, closes the socket, and
  returns to the same dashboard page.
- If the key is missing or startup fails, the detail deck shows a localizable
  error and remains safe with the microphone off.

## Connection architecture

Use a short-lived token and a direct Realtime WebSocket:

1. The phone companion stores a validated standard OpenAI API key in Even
   local storage.
2. When the AI detail deck is entered, the client sends the key once to a
   same-origin `POST /api/realtime-token` endpoint.
3. The endpoint forwards the key only in the Authorization header of an OpenAI
   `POST /v1/realtime/client_secrets` request and returns the short-lived
   client secret. It does not log or persist the key.
4. The WebView opens `wss://api.openai.com/v1/realtime` with the ephemeral
   token in the documented WebSocket subprotocol.
5. SDK `audioControl(true, AudioInputSource.Glasses)` opens the G2 microphone.
   `onEvenHubEvent` PCM chunks are base64-encoded and sent as
   `input_audio_buffer.append` events.
6. Leaving the deck first closes microphone input, unsubscribes from audio
   events, and closes the WebSocket.

This keeps audio off the Sandevistan Worker, removes a continuously relayed
connection, and ensures the standard key never enters the shipped bundle or a
Realtime WebSocket.

## Realtime session

- Model: stable `gpt-realtime` alias.
- Output modalities: text only.
- Input audio: 16 kHz signed 16-bit little-endian mono PCM.
- Noise reduction: far-field.
- Transcription: a Realtime-compatible transcription model.
- Turn detection: semantic VAD with automatic response creation and response
  interruption.
- Instructions: answer concisely in the active Sandevistan locale and format
  text for a small monochrome HUD.

The client handles speech lifecycle, transcription delta/completion, response
text delta/completion, response usage, and error events. A session remains one
continuous conversation until the detail deck is left.

## Rendering and refresh discipline

Realtime text deltas must not create a transport queue. AI state stores only
the latest text and notifies the HUD through a latest-wins scheduler:

- at most one streaming refresh attempt every 300 ms;
- drop an attempt if the image transport is busy;
- perform one final refresh attempt when a user transcript or assistant
  response completes;
- never retry a failed image refresh; the next AI event becomes the next
  opportunity.

Dashboard and detail rendering remain inside the fixed 576 x 288 Canvas and
use the existing four-tile transport contract.

## Local history and cost

Persist only:

- up to three completed conversation summaries/excerpts;
- daily aggregated Realtime usage split into text input, cached text input,
  audio input, cached audio input, and text output tokens;
- the model and pricing version used for each aggregate.

Do not persist raw audio or a full transcript. Weekly totals start on Monday in
the device timezone; monthly totals start on the first day of the local month.
Cost is explicitly labeled as estimated and computed from a single model-price
registry so price updates do not alter storage or UI code.

The phone AI screen provides the masked BYOK field, save/delete controls,
weekly and monthly estimates, token details, recent excerpts, and a local
history/usage reset action.

## Security boundaries

- Never include the provided test key or any API key in source, build output,
  diagnostics, URLs, error text, or tests.
- Reject empty, control-character, or implausibly sized keys.
- Accept the BYOK header only on the token endpoint and never reflect it.
- Bound request size and upstream response size, use a timeout, and return
  generic client-safe errors.
- Stop capture on every exit and cleanup path, including connection errors and
  component disposal.

## Testing

- Unit-test key validation/storage and ensure keys are never returned in error
  payloads.
- Unit-test token endpoint success, upstream rejection, timeout, and missing
  key behavior with a mocked fetch.
- Unit-test Realtime event reduction, semantic-VAD session configuration,
  usage aggregation, weekly/monthly estimates, excerpt retention, and
  latest-wins refresh scheduling.
- Unit-test HUD navigation so dashboard visibility is passive, tap starts a
  session effect, pause/resume works, and double tap stops the session.
- Unit-test phone AI configuration and HUD layout integration.
- Run typecheck, all Vitest tests, repository tests, Sites Worker tests, build,
  and package verification without a real key.
