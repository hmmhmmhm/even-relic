# Ask AI Function Tools Design

## Goal

Extend the continuous text-only Ask AI conversation with three built-in
read-only functions—current time, exact current location, and live web
search—and user-configured remote MCP servers. The model chooses whether a tool
is needed and continues the same Realtime turn after its result. Tool execution
must preserve the existing G2 microphone, native Text-container presentation,
tap interruption, and double-tap exit behavior.

## Tool contract

The Realtime session advertises `tool_choice: auto` and these function tools:

- `get_current_time` takes no arguments and returns the device-local ISO time,
  UTC offset, IANA timezone, locale, and localized display time.
- `get_current_location` takes no arguments and returns the latest exact SDK
  latitude and longitude together with accuracy, speed, heading, source, and
  fix timestamp when available.
- `search_web` takes a required bounded query and performs one OpenAI Responses
  API request with the hosted `web_search` tool. It returns a concise result and
  a bounded list of cited source titles and URLs.

Time and location execute inside the WebView. Web search executes through a
same-origin Worker endpoint because the standard BYOK must not be exposed to an
additional browser request target. The endpoint accepts the key only in the
existing private request header, forwards it to OpenAI for that request, and
never persists, logs, or reflects it.

Exact coordinates are disclosed to OpenAI only after the model explicitly
calls `get_current_location`. They are not inserted into session instructions,
attached to ordinary search calls, or sent during session startup. A demo
coordinate, missing fix, or unusably old fix returns a structured unavailable
result instead of pretending to be the user's current location.

## Realtime flow

When a completed Realtime response contains one or more function-call output
items, the session validates the function name and JSON arguments, executes
each recognized call once, and sends a `conversation.item.create` item of type
`function_call_output` for every call ID. After all outputs are acknowledged by
the local WebSocket send path, one `response.create` asks the model to continue
the turn.

Call IDs are deduplicated for the lifetime of the session. Unknown tools,
invalid arguments, unavailable device data, upstream rejection, timeout, and
abort all produce small structured error outputs. No failed tool call is
queued, retried, or replayed on a later event.

The visible protocol stays in a thinking/tool state while a function is
running. A normal detail tap aborts an active search request or cancels the
follow-up model response, reveals the latest received text, and returns to
listening with the microphone still open. Double tap aborts all active tool
work before closing the Realtime session and restoring the Canvas dashboard.
Late tool results and late model deltas from a cancelled turn are ignored.

## User-configured MCP servers

The phone Ask AI detail screen gains a local MCP server manager. A user may
add, rename, edit, enable, disable, and delete remote servers. Each record
contains a display name, an HTTPS server URL, an optional bearer token, and an
optional comma-separated allowlist of tool names. The manager stores records
only in Even local storage and masks authentication values after save. URLs,
labels, token lengths, tool-name syntax, record count, and serialized size are
strictly bounded.

At the start of a new Ask AI session, enabled records become Realtime `mcp`
tools with stable unique `server_label` values, `server_url`, optional
`authorization`, optional `allowed_tools`, and `require_approval` enabled. The
MCP server connects directly from the OpenAI Realtime service; Sandevistan's
Worker does not proxy, inspect, or persist MCP traffic or credentials. Editing
the phone configuration affects the next AI session and never mutates a live
session underneath an active response.

Every user-added MCP call requires explicit approval. When Realtime emits an
`mcp_approval_request`, the native glasses view temporarily replaces the normal
listening status with a localized approval prompt containing the configured
server name, tool name, and a short bounded argument summary:

- one tap sends an `mcp_approval_response` with `approve: true` and returns to
  the thinking state;
- double tap first sends `approve: false`, then performs the normal AI-detail
  exit and microphone cleanup;
- while no approval is pending, one tap retains its established response
  interruption behavior.

An approval request is never auto-approved, queued, or reused for another
call. MCP list/import and call failures are visible as localized nonfatal
conversation errors and do not close the microphone. Session stop rejects any
still-pending approvals best-effort before closing the socket. Remote MCP
servers do not receive the whole transcript automatically, but the UI warns
that they receive arguments selected by the model and may perform external
actions after approval.

## Web-search endpoint

Add `POST /api/ai-web-search` to the shared server router and Worker build. The
request contains only a query and active locale. The handler:

1. applies the existing OpenAI-key validation and strict JSON/body limits;
2. validates query length and rejects control characters;
3. calls the OpenAI Responses API with one supported search-capable model and
   the `web_search` tool;
4. requests source metadata, extracts only output text and URL citation
   annotations, and returns a bounded normalized payload;
5. aborts on a short timeout and maps upstream failures to generic client-safe
   errors.

The response body and diagnostic logs must never contain the BYOK. Search
output is treated as untrusted data: titles and snippets are plain text, URL
protocols are restricted to HTTPS, and result counts and lengths are bounded.

## Citations and local history

Glasses responses use compact numeric source markers such as `[1]`. Because a
glasses Text container cannot open links, the same turn stores its normalized
source list alongside the local conversation excerpt. The phone Ask AI detail
screen renders those source titles as clearly visible HTTPS links. Only cited
sources returned by OpenAI are stored, with the same existing bounded recent
history policy; raw search payloads and page contents are not persisted.

The history schema gains an optional sources field and remains backward
compatible with records saved before function tools. Resetting AI history also
removes stored source metadata.

## Cost accounting

Realtime usage continues through the existing ledger. The search endpoint also
returns the Responses API token usage and count of web-search actions. The
client aggregates those values into the same device-local daily usage record
under a versioned search category so weekly and monthly estimates do not
silently omit searches. Pricing remains centralized; unknown or changed tool
pricing is labeled as an incomplete estimate rather than fabricated.

## Localization

Tool definitions instruct the model to use the active locale. Local visible
states and errors, including searching, location unavailable, tool timeout, and
search failure, plus MCP loading, approval, rejection, and failure, are added to
the centralized Ask AI dictionary for all thirty locales. Tool names and JSON
keys remain stable English protocol identifiers and are never used as
user-facing labels.

## Verification

- Protocol tests prove all three tools appear in `session.update`, complete
  function calls generate matching `function_call_output` items, duplicate
  call IDs are ignored, and exactly one follow-up response is created.
- Session tests prove current-time formatting, exact live-location output,
  rejection of demo/unavailable fixes, search success, failure, timeout, tap
  abort, and stop cleanup.
- API tests cover authentication, request bounds, OpenAI request shape,
  citation normalization, usage normalization, unsafe URLs, upstream errors,
  timeout, and key non-disclosure.
- Runtime/history tests cover source retention, backward compatibility, search
  usage aggregation, and reset behavior.
- Phone tests prove cited sources are visible and clickable and that all new
  local UI strings exist in every supported locale.
- MCP tests cover local-only credential storage, validation and masking,
  session tool construction, optional allowlists, lifecycle events, tap
  approval, exit rejection, failure recovery, and credential non-disclosure.
- Run typecheck, Vitest, server/Worker tests, production build, and package
  verification without a real OpenAI key.
