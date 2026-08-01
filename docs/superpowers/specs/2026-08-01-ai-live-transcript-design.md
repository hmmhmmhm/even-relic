# Ask AI Live Transcript Design

## Goal

Keep the current canvas-based Ask AI detail screen while making it behave like
a live chat. The user's utterance and the assistant's streaming answer share
one viewport, the live viewport follows the newest text automatically, and
scrolling is reserved for intentionally reviewing older conversation content.

## Approaches considered

### 1. Canvas conversation viewport — selected

Keep the existing visual system and four-tile transport. Store a bounded
conversation timeline independently from rendering, compose both roles into
contiguous pages, and follow the last page while the user is in live mode.
Realtime deltas update state immediately; the existing latest-wins scheduler
may coalesce several characters into one transmitted frame when the image
transport is busy.

This preserves the established typography and layout and is the lowest-risk
way to validate the interaction on hardware.

### 2. Hybrid canvas and SDK text container

Use the canvas for the frame and one SDK text container for the conversation.
This can reduce visible text latency, but SDK font metrics, positioning, and
wrapping are less controllable. It also introduces synchronization between
two rendering systems.

### 3. Full SDK text detail page

Rebuild the AI detail page entirely from SDK text containers. This offers the
most direct text updates but gives up the current HUD design and makes precise
conversation paging harder. It remains a fallback if the canvas experiment is
not responsive enough on G2 hardware.

## Conversation state

The Realtime protocol state owns a bounded list of completed turns plus the
current user and assistant text. When semantic VAD starts a new utterance, the
previous non-empty turn moves into the completed list before the current text
is cleared. Raw audio is never stored.

The bound is twelve completed turns and 8,000 characters across the live
timeline. This is enough for local review without allowing a long session to
grow indefinitely. Session usage accounting remains cumulative and unchanged.

## Viewport composition

The HUD snapshot converts the timeline into role-labelled lines in chronological
order:

```text
YOU // Hello.
AI  // Hello. How can I help?
YOU // What is on my schedule?
AI  // ...streaming text...
```

Lines from both roles are packed into the same six-line viewport. A role is
not forced onto a separate page. If the current assistant answer grows beyond
the viewport, pages become contiguous windows of the same conversation.

## Live following and history browsing

AI detail mode starts with `aiFollowsLatest = true` and selects the last page.
Whenever streaming creates or changes pages, synchronization keeps the last
page selected.

- Scrolling toward older pages disables automatic following and pins the
  selected history page while new text continues arriving.
- Scrolling forward changes only the selected history page.
- Reaching the newest page re-enables automatic following.
- Leaving and re-entering Ask AI starts at the newest page again.

The header marks the newest page as `LIVE` and older pinned pages as `HISTORY`.

## Rendering and transport

Every transcription or assistant text delta updates the conversation state as
received. The 300 ms latest-wins scheduler remains queue-free: it requests a
new canvas frame when possible, drops attempts while transport is busy, and
performs a final refresh on completion. Therefore the UI streams progressively
without waiting for a full response, while hardware throughput may combine
multiple character deltas into one visible frame.

The conversation model and paging API remain renderer-independent. A later
SDK text-container renderer can consume the same live page and follow state
without changing Realtime, history, or cost logic.

## Error and lifecycle behavior

Pause, resume, connection errors, and microphone cleanup keep the current
behavior. A partial live turn remains visible if an error occurs. Stopping the
session persists the most recent non-empty turn and cumulative usage exactly
once.

## Verification

- Reducer tests prove completed turns survive a new semantic-VAD turn.
- Snapshot tests prove a short question and answer share one page and long
  conversations create chronological pages.
- View tests prove live mode follows the newest page, history mode stays
  pinned, and returning to the newest page resumes following.
- Renderer tests prove live/history indicators and both role labels appear.
- Existing session, cost, history, transport, type, Sites, and packaging tests
  remain green.
