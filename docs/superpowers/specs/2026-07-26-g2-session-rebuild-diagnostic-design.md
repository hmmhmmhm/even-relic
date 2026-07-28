# G2 session reconfiguration diagnostic design

## Background

We reapplied the `200×100` configuration that was successful in the official image example, but
`createStartUpPageContainer()` kept returning `invalid`. Therefore PNG format,
Image size and number of containers alone cannot explain the current symptom.

According to the Even Hub SDK documentation, creation of the start page only occurs once in the Glasses UI session.
You can call Subsequent page changes must use `rebuildPageContainer()`.
However, since the user saw the same error even after completely closing the app, the remaining
Rather than determining the session as the cause, the creation and reconstruction results are collected together.

## Target

- Distinguish whether page creation failure is due to an existing session or the page definition itself.
- Always display the app version and diagnostic build name in the web view.
- Send the reference image only when the page is ready.
- The existing URL profile for size comparison is maintained.

Actual Sandevistan functions such as sensors, full screen HUD, STT, etc. are not included in the scope of this diagnosis.
No.

## Selected access

Use conditional reconstruction.

1. Once the bridge is ready, try creating a start page with the selected profile.
2. If the creation result is `success`, move to the image transmission step.
3. If the creation result is `invalid`, reorganization is attempted once with the same page definition.
4. If reconstruction is successful, move to the image transmission step.
5. If reconstruction fails, it displays an error and does not start image transfer.
6. Do not attempt reconstruction on `oversize` or `outOfMemory`.

The reason for rebuilding only on `invalid` is both session duplication and incorrect page definitions.
Because it can produce the same results. If you check the reconstruction results, you will find two cases:
can be distinguished.

The always-reconfiguring method does not guarantee first execution. After force quitting again
Do not use the creation method because it can terminate the web view and the app itself.

## Show webview

Fixed display of the next version string below the title.

`v0.1.0 · session-rebuild-1`

The status area contains information that identifies the next boundary rather than just overwriting the last step.
Display phrases in order.

- `BRIDGE WAIT`
- `BRIDGE READY`
- `PAGE CREATING`
- `PAGE RESULT: <result>`
- `PAGE REBUILDING`
- `PAGE REBUILD RESULT: true|false`
- `PAGE READY <width>x<height> - SEND IN 3S`

When an error occurs, the last success boundary and failure cause should be readable from the webview.
Do it.

## Data flow

Select a diagnostic profile from the webview URL and define the image container for the profile.
Pass it to the page initialization function. The initialization function succeeds in creating or reconstructing
Returns only the bridge. The caller waits 3 seconds after loading the image to the returned bridge.
Wait and transmit once serially.

The current baseline profile consists of two text containers and `200×100` like the official example.
Uses one image container.

## Error handling

| Generated Results | Reconstruction | image transfer |
|---|---|---|
| `success` | do not call | progress |
| `invalid` | call once | Proceed only when reconfiguration is successful |
| `oversize` | do not call | interruption |
| `outOfMemory` | do not call | interruption |

If the bridge call itself throws an exception, it immediately aborts at that boundary and sends the exception message.
Displayed in webview.

## Test

- When creation is successful, reconfiguration is not called.
- If the creation result is `invalid` and reconfiguration is successful, initialization is completed.
- If the creation result is `invalid` and reconstruction fails, a clear error is returned.
- Do not call reconstruction for `oversize` and `outOfMemory`.
- The status text for each boundary is recorded in the correct order.
- The app version and diagnostic build name are displayed together in the web view.

## Success Criteria

- Automatic tests and TypeScript builds pass.
- The new URL returns HTTP `200` at the Tailscale address.
- In actual G2 execution, the creation results and reconstruction results can be distinguished in the web view.
- Image transmission begins 3 seconds later only if page creation or reconstruction is successful.
