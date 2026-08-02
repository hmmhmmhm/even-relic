# Ask AI Tool Status, Pacing, and Cost Design

## Goal

Make Ask AI easier to understand and control on the glasses while keeping the
phone companion responsible for durable preferences. The glasses must show
which tool is currently running, pace completed assistant text at a user-set
speed, and offer an explicit tap-to-reveal shortcut once generation is
complete. The phone companion must expose the pacing control and show a more
accurate local estimate of Realtime and web-search spend.

## Product behavior

- The Ask AI detail HUD uses its existing top status line for transient tool
  activity. Tool activity is not added to the conversation transcript.
- Localized statuses cover current time, current location, web search, and MCP
  tool execution. Unknown tools use a localized generic tool label. Arguments,
  search queries, API keys, and raw tool output are never displayed.
- Status priority is: pending MCP approval, active tool, delayed answer
  presentation, listening/thinking, and error/ready state.
- Assistant text is presented one grapheme at a time. The default interval is
  200 ms. The phone AI screen exposes a 100-1000 ms slider in 50 ms steps.
- A slider change is persisted in device-local storage and applies to the next
  scheduled grapheme without recreating the Realtime session.
- When the model response is complete but the presentation pacer has not yet
  revealed the entire received answer, the bottom line shows a localized
  equivalent of `Tap to reveal the full answer`.
- Tapping in that state flushes the already completed answer in one HUD update.
  While the model is still generating, the hint is absent and the existing tap
  behavior cancels generation and reveals only the text received so far.
- All new user-facing strings are complete for every registered phone and HUD
  locale. Locale completeness tests prevent a new language from silently
  falling back for these controls.

## Explicit tool lifecycle

`AiRealtimeProtocolState` gains a bounded `activeTool` value with a safe kind,
optional MCP display name, and lifecycle identifier. The session, rather than
the renderer, owns this state.

Built-in function tools publish a start state immediately before execution and
clear the matching lifecycle identifier in `finally`, covering success,
failure, cancellation, and socket shutdown. A late completion from an older
tool cannot clear a newer tool because identifiers must match.

MCP status follows the Realtime MCP event lifecycle. Approval remains a
separate, higher-priority state. Execution begins on an in-progress MCP call
event and ends on the matching completed or failed item, with response
completion and session cleanup as defensive clearing boundaries. This follows
the documented distinction between app-executed function tools and
Realtime-executed MCP tools.

Only the safe state is projected into `AiHudSnapshot`. The native text HUD and
canvas fallback consume the same localized status formatter, so both rendering
paths remain behaviorally consistent.

## Presentation pacing

The presentation pacer remains the only owner of delayed text. It stores a
mutable, clamped interval and consults the current value whenever it schedules
the next grapheme. No timer backlog or output queue is introduced: there is at
most one scheduled tick and one in-flight presentation acknowledgement.

The pacer exposes `canRevealFullResponse` only when all of the following hold:

1. the protocol has received response completion;
2. the target assistant text is longer than the presented assistant text;
3. the active turn has not been cancelled or replaced.

`flush()` cancels the one pending timer, advances directly to the current
target, and waits for the normal presentation acknowledgement. Generation
deltas received after cancellation are rejected by the existing response
identity guard.

The interval preference is stored separately from secrets and can be cleared
without affecting the OpenAI key, history, or usage ledger. Invalid stored
values are clamped to the supported range; missing or unreadable values use
200 ms.

## Accurate estimated cost ledger

The estimate includes two distinct billable paths:

1. Realtime session usage returned by Realtime events.
2. The separate Responses API request used by the web-search proxy, including
   model tokens and the web-search action fee.

Counting both paths is intentional. Search results passed back into Realtime
may later appear in Realtime input usage and are separately billable from the
Responses API search request.

The web-search endpoint returns a bounded usage envelope containing the actual
model identifier, total input tokens, cached input tokens, output tokens, and
the number of billable `search` actions. It counts search actions rather than
all navigation actions. The client validates every field and never trusts a
client-provided model or price.

The pricing registry is model-aware and versioned. The initial standard-tier
snapshot is dated 2026-08-02 and includes the active Realtime, transcription,
and search-proxy models. For the active `gpt-5.5` search request it uses the
official standard prices of $5.00 per million uncached input tokens, $0.50 per
million cached input tokens, and $30.00 per million output tokens. Each
billable web-search action adds $10.00 per 1,000 calls ($0.01 per action).
Search content tokens are included in the model input usage returned by the
Responses API and are therefore priced at the model input rate.

Cost is calculated at event time with integer nano-USD units, then persisted
with the raw counters and pricing-version identifier in the daily local
ledger. This avoids floating-point accumulation and prevents later price-table
updates from rewriting historical estimates. Week and month totals sum stored
event-time costs and round only for display.

Existing ledger entries have no reliable model snapshot. They remain readable
and are migrated as legacy estimates using their original category rates;
their historical search component is not silently reclassified as `gpt-5.5`.
All new events use snapshot pricing. An unknown returned model records the raw
usage as unpriced instead of applying an invented rate; the phone screen marks
the total as containing unpriced usage.

The estimate remains explicitly labeled as an estimate because account-level
service tiers, regional uplifts, billing rounding, and future price changes can
differ from the local registry. Time and location tools add no external cost.
Third-party MCP billing is excluded because OpenAI usage events cannot measure
it.

## Data flow

1. Realtime or tool events update the protocol state.
2. The session publishes a safe active-tool projection and usage deltas.
3. The pacer derives the presented transcript, display phase, and reveal hint.
4. The runtime publishes one HUD snapshot shared by native-text and canvas
   renderers.
5. The phone writes a validated pacing preference through the existing local
   storage boundary and updates the live pacer.
6. On session exit, raw usage and event-time nano-USD estimates are merged into
   the daily ledger. The dashboard and phone screen derive local week/month
   totals from that ledger.

## Failure behavior

- Tool failures clear the status and retain the existing localized AI error
  behavior. They do not expose upstream messages on the HUD.
- Session exit, socket close, and runtime disposal clear active tool, pending
  timers, and the reveal hint.
- A failed preference write leaves the live and persisted value unchanged and
  shows the existing phone storage error.
- Missing or malformed usage fields contribute no invented cost. Their event
  is counted as unpriced for transparency.
- Search timeouts and failures do not add a search fee unless the proxy
  received a valid upstream response reporting a billable search action.
- No failed refresh or tool operation is queued for replay; the next event is
  the next opportunity to update the display.

## Testing

- Test built-in tool start, success, failure, cancellation, stale completion,
  and cleanup transitions.
- Test MCP approval, in-progress, completed, failed, response-complete, and
  cleanup transitions.
- Test status priority and localized formatting across all registered locales.
- Test the 200 ms default, range clamping, 50 ms slider steps, persistence,
  live interval changes, single-timer discipline, and presentation
  acknowledgements.
- Test that the reveal hint appears only after response completion with text
  still withheld, and that tap flushes completed text while tap during
  generation preserves cancellation semantics.
- Test search usage parsing for model, total/cached input, output, and only
  billable search actions.
- Test nano-USD calculations, model-specific prices, the $0.01 search action
  fee, no double counting between Realtime and Responses usage, unknown-model
  handling, legacy-ledger migration, and week/month boundaries.
- Test the phone slider, cost estimate, and unpriced-usage indicator.
- Run typecheck, unit tests, Sites/API tests, production build, and package
  verification without a real API key.

## Out of scope

- Fetching live pricing from OpenAI at runtime.
- Claiming parity with the OpenAI invoice.
- Estimating third-party MCP server charges.
- Adding tool messages to stored conversation history.
- Changing the AI model, VAD behavior, microphone lifecycle, or existing HUD
  navigation.
