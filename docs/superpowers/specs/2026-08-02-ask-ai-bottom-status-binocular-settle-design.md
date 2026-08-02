# Ask AI Bottom Status and Binocular Restore Settle Design

Date: 2026-08-02

Status: Approved

## Goal

Keep transient Ask AI activity text at the bottom of the native transcript and
prevent the lower-right HUD tile from appearing in only one lens after leaving
Ask AI.

## Native status placement

The rolling transcript remains the first visible content. Thinking and active
tool labels, including Web search, use the same trailing status slot as the
existing Listening label. Insert one blank display row before that status when
the transcript is non-empty. Do not restore the hidden Displaying label or
change the standalone MCP approval prompt.

The formatter reserves two rows for a trailing status before selecting visible
transcript lines. This keeps the status visible without moving it to the top or
letting it become a transcript scroll target.

## Binocular restore barrier

The accepted AI exit path remains:

1. stop the Realtime session and microphone;
2. rebuild the proven blank event page to neutralize native Text updates;
3. rebuild the established five-container Canvas page;
4. wait 200 ms for both lenses to install the four image containers;
5. invalidate the successful-image cache and send IDs 3, 5, 2, and 4 through
   the existing four-call pipeline.

The wait is scoped only to native Ask AI restoration. Startup, paging, normal
external refresh, and blank display hide/restore keep their existing timing and
concurrency. The SDK exposes no page-ready event, so a bounded settle interval
is the smallest observable barrier between a successful page rebuild and image
updates.

Late native Text updates remain dropped for the complete neutralize, rebuild,
settle, and image-send transition. A failed neutral or image-page rebuild sends
no image data, performs no automatic retry, and leaves the controller active so
a later independent exit input can try again.

## Diagnostics and verification

Add one diagnostic after the image-page rebuild and before encoding:

```text
[REFRESH] native AI image page ready · 200ms
```

Formatter tests cover Thinking and Web search below the transcript. Transport
tests prove the settle callback occurs after the image-page rebuild and before
the first image update, and that Text updates remain dropped while waiting.
Run the complete test, type, repository, Sites, build, and package gates before
deployment to the existing port 4179 hardware preview.
