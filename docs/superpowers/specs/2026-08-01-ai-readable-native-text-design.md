# Readable Native Ask AI Text Design

## Goal

Make the G2 Ask AI detail experience readable and dependable without returning
to Canvas rendering. The user must leave the conversation with double tap,
never pause the microphone with a normal tap, see fast model output at a
bounded reading speed, and understand every native status and control in the
selected one of Sandevistan's thirty languages.

## Root cause

The current tap action calls `audioControl(false)` through `pause()`. Some G2
sessions do not confirm that one-shot close request, so the pause path promotes
the condition to a fatal `G2 microphone could not close` error and prevents the
input transition from completing. Tap-level microphone ownership is also
unnecessary because leaving Ask AI already owns the complete session teardown.

The transcript currently follows the newest generated page immediately. A
fast Realtime response can therefore advance through several six-line pages
before a successful SDK text update is visible, leaving only the final page on
screen. Slowing only the SDK update interval would still skip content.

## Interaction

- Tapping the Ask AI dashboard card opens the native text page and starts one
  Realtime session with the G2 microphone.
- A single tap inside Ask AI is consumed without changing microphone or
  session state. No pause or resume label is displayed.
- Scrolling selects transcript history exactly as before.
- Double tap is the sole exit action. It stops the session, performs a
  best-effort microphone close, persists the conversation and usage, rebuilds
  the established Canvas page, and sends the dashboard frame once.
- Failure to receive SDK confirmation for microphone closure is diagnostic
  information, not a reason to trap the user in the native page. Closing the
  audio subscription and Realtime socket ends conversation processing first.

## Readable presentation

Realtime protocol state remains authoritative and unmodified for persistence,
cost calculation, and conversation continuity. A separate presentation pacer
owns only the snapshot shown on the glasses.

User transcription is accepted immediately. Assistant output is copied from
the authoritative snapshot into the presented snapshot by Unicode grapheme,
up to six graphemes every 250 ms (24 graphemes per second). If the model is
slower than that limit, text remains effectively live. If it is faster, the
pacer retains the newest target snapshot and drains toward it without storing
individual delta events. It never skips undisplayed assistant text.

While presented assistant text trails the authoritative response, the native
status is localized as "displaying response". When the backlog is empty and
the Realtime phase is listening, a localized listening prompt remains visible
alongside the latest conversation. Manual history selection disables automatic
page following but does not pause the pacer; returning to the latest page shows
the current presented state.

The pacer is disposed when leaving Ask AI. Session stop and local persistence
use the authoritative state, so visual pacing never delays resource cleanup or
data integrity.

## Localization

The centralized Ask AI dictionary gains complete native-detail strings for all
thirty supported locales. The compile-time complete map covers:

- Ask AI title and user/assistant role labels;
- ready, connecting, listening, thinking, displaying, key-required, and error
  states;
- live and history page labels;
- listening prompt;
- transcript scroll and double-tap-back controls.

The English literals in both the official Text-container detail and Canvas
fallback detail are replaced with these keys. No locale may silently inherit an
English native-detail string; the locale coverage test inspects the complete
thirty-locale map.

## Refresh and failure policy

The official one-container page and `textContainerUpgrade` transport remain.
The pacer emits at 250 ms, while the existing queue-free scheduler and busy-drop
transport continue to prevent backlogs. The final target remains pending until
fully presented or the user exits; exiting never waits for visual drain.

If a native text update fails, the next pacer tick observes the newest full
presentation snapshot and may try again. There is no event queue and no retry
loop. Canvas image refreshes remain suppressed while the native page is active.

## Verification

- Input reducer and controller tests prove tap is a no-op and double tap owns
  teardown and Canvas restoration.
- Realtime session tests prove stop closes subscription/socket and resolves
  even when microphone-close confirmation is unavailable.
- Pacer tests prove slow output stays live, fast output is bounded to six
  graphemes per tick, intermediate text is preserved, and disposal stops work.
- Native and Canvas formatter tests prove Korean output and complete
  thirty-locale coverage, including the localized listening prompt.
- Existing Realtime, image transport, i18n, build, Sites, and package gates
  remain green.
