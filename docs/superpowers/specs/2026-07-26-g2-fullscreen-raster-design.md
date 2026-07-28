# G2 full screen raster experiment design

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

Selected Sandevistan HUD cyan as static image across G2's 576×288 display area
Display. The purpose of this experiment is only to check information density and actual readability.
Dynamic functions such as sensors, maps, and STT are not connected.

## Confirmed premise

- The G2 display area is 576×288.
- The allowable size of one image container is 20~288×20~144.
- Up to four image containers can be placed on one page.
- The official 16-bit RGB PNG returned an `imageException` on the actual device.
- If you change the same image to 8-bit RGB PNG, both the original size and 200×100 size are displayed.
  Returned `success`.
- The selected Sandevistan HUD original is 1774×887, 8-bit RGB PNG and is identical to the screen.
  It is a 2:1 ratio.

## Screen composition

The original HUD is first reduced to 576×288 and then cut into the following four areas.

| container | Location | size | Source area |
|---|---:|---:|---:|
| `relicTL` | 0, 0 | 288×144 | 0, 0 |
| `relicTR` | 288, 0 | 288×144 | 288, 0 |
| `relicBL` | 0, 144 | 288×144 | 0, 144 |
| `relicBR` | 288, 144 | 288×144 | 288, 144 |

All four files are created in advance as 8-bit RGB PNG. Blank text covering the entire screen
Place one container behind the image to receive only tap events. Total containers on the page
The number is 5.

## Transmission flow

1. Create a page with an empty event layer and four image containers.
2. Display ‘READY - TAP TO SEND’ on the mobile phone screen.
3. The user taps the Glasses Touch Bar or R1 once.
4. Transmit one page at a time in the following order: `relicTL → relicTR → relicBL → relicBR`.
5. Do not send two pages at the same time.
6. Display the normalized result and progress of each tile on the phone screen.
7. If all four shots are successful, `FULLSCREEN RESULT: success` is displayed.

Since it uses up all four image slots on the glasses, the glasses text for progress will be
do not add Check the failure information on the mobile phone screen.

## Error handling

- If page creation is `invalid`, reconfigure once with the same container configuration.
- If one tile is not `success`, the next tile is not sent and the tile name and result are sent.
  Leave it on your phone screen.
- The omitted 0 value of a single tap event is restored using the previously verified method.
- Double tap closes the app without starting image transfer.

## Verification

Automated testing checks:

- The positions and sizes of the four tiles accurately cover 576×288 without any gaps.
- The four generated PNGs are each 288×144, 8-bit RGB.
- Image transmission is in the order of TL, TR, BL, BR and is always serial.
- Transfer starts only once with a single tap.
- No follow-up tiles are sent after the first failure.

After building, run it with a new port and QR to separate it from the previous WebView cache. In practical equipment
The boundaries, omissions, distortions, brightness, and text readability of the four tiles are visually evaluated.
