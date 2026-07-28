# SDK 0.0.10 Image transmission A/B diagnostic design

## Background

On the actual G2, the first `288×144` PNG tile of the current root and the `/diagnostic-v10`
Click trigger `200×100` 1-bit BMP all returned `SENDFAILED`. two
The experiments were conducted to transfer images from the SDK to the glasses, although the image format, size and transfer timing were different.
The sending steps are the same.

The current app uses `@evenrealities/even_hub_sdk` `0.0.12`. official image
The template uses `0.0.10`, and when serializing the same `ImageRawDataUpdate`
Only `0.0.12` adds `compressMode: 2`. `0.0.12` change history image
It explains that LZ4 compression has been added to the transmission.

## Target

Currently, only the SDK version is lowered to `0.0.10` without changing the Even app and G2 firmware.
Determine whether `SENDFAILED` is related to the compressed transmission mode of `0.0.12`.

This experiment does not adopt SDK downgrade as a product direction. separation of causes
This is a one-time A/B diagnosis for

## Selected access

Pin the SDK to exactly `0.0.10` in the local diagnostics branch.

- Set the SDK version of `package.json` and lockfile to `0.0.10`.
- Set the minimum SDK version and version contract test of `app.json` to `0.0.10`.
- Page definitions in `/diagnostic-v10`, 1-bit BMP bytes, click triggers and transfers
  The order does not change.
- Change only the `build` identifier of QR to `sdk-0010-ab` to distinguish it from the previous WebView.
- Uses the same `4173` port as the current Tailscale server.

## Alternatives considered

### Remove only `compressMode` from `0.0.12` request

It requires bypassing SDK internal serialization and falls outside the official API contract. SDK even if it fails
It is difficult to tell whether it is a version issue or a bypass code issue, so do not select it.

### Update Even app and G2 firmware first

This is desirable for a production environment, but apps, firmware, and connection sessions change simultaneously. this time
In A/B experiments, there are too many causal variables, so it is placed in a separate step after confirming the results.

## Data flow

1. `/diagnostic-v10` creates or reconfigures the three existing container pages.
2. Mark ‘TEXT READY - CLICK TO SEND’ on the glasses.
3. User clicks once.
4. Insert the existing `200×100` 1-bit BMP into `ImageRawDataUpdate`.
5. SDK `0.0.10` serializes image requests without `compressMode: 2`.
6. Display the normalized image transmission results in WebView.

## Interpretation of results

| Results | Interpretation | Next steps |
|---|---|---|
| `success` | Compatibility issues between `0.0.12` compressed transfer mode and current host environment | Re-verify `0.0.12` after app/firmware update |
| `SENDFAILED` | SDK compression mode is not the main cause | Restore to `0.0.12` and diagnose app/firmware/BLE connection status |
| Other image errors | Differences in image conversion behavior by SDK version | Re-verify the same version with the official `sample.png` |

It records only one result and does not add automatic retries. Retry is intermittent BLE
Hiding failures can obscure A/B interpretation.

## Test

- Version contract test matches SDK `0.0.10` in `package.json` and `app.json`
  Confirm.
- It passes the existing click trigger and BMP transmission order tests as is.
- Full Vitest, TypeScript inspection, production build and Sites packaging inspection
  Run.
- Tailscale diagnostic URL returns HTTP `200` and `4173` listener is one
  Confirm.

## Success Criteria

- Other than the SDK version, the image transfer operation does not change.
- All automatic verification passes.
- Reproduce either `success` or `SENDFAILED` after one click in the new QR
  Record the results.
- Depending on the results, the next step is either restoring SDK `0.0.12` or updating the host.
  It is decided as one.

## Hardware result

- SDK: `0.0.10`
- Build: `sdk-0010-ab`
- Trigger: one manual G2 or R1 click
- Result: `success`
- Optical observation: a very small dot/checker pattern was visible on the G2.
- Interpretation: the SDK `0.0.12` image transport change is incompatible with
  the current Even app or G2 firmware environment.
- Next: update the Even app and G2 firmware, then retest SDK `0.0.12`.

## Full HUD follow-up result

- SDK: `0.0.10`
- Build: `hud-4tile-sdk0010`
- Layout: four `288×144` image containers covering the `576×288` display
- Result: all four tiles rendered successfully on the physical G2
- Optical observation: the full HUD was very clear and felt larger than the
  centered `200×100` diagnostic pattern
- Size conclusion: this layout already fills the maximum SDK raster area;
  future size changes must scale content within the same frame
