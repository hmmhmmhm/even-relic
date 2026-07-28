# G2 Fast Canvas content reorganization design

## Target

Layout of `/hud-canvas-fast` approved for structure and transition speed on actual device and
While maintaining the two-tile transfer agreement, the sequence of four pages and sample content are actually
Organize it close to its purpose.

## Approved page order

The scroll order rotates as follows.

1. `OVERVIEW`
2. `NEWS`
3. `TODO`
4. `NAVIGATION`

The `288×288` map on the left remains the same on all pages. Image when app starts
Send ID `2, 3, 4, 5`, and when scrolling, only right image ID `3, 5` is sent.
There will be no changes to existing contracts for serial transmission.

## Reviewed battery display methods

### 1. Static sample values

This method always draws a fixed value such as `G2 82%`. The implementation is the simplest, but practical
Do not use it as it can be misunderstood as a status.

### 2. SDK single device snapshot

Model, battery level, and charging status of a device returned by `getDeviceInfo()`
Draw before initial Canvas transfer. If G2, `G2 82%`, if R1, `R1 64%`, charge
If it is in progress, add `+` at the end. If no information is obtained, `BATTERY --` is displayed.

Currently in SDK `0.0.10` there is no public API to enumerate multiple devices simultaneously.
The values ​​of G2 and R1 cannot be guaranteed at the same time. By accurately revealing this limitation,
We adopt this method of using values.

### 3. Immediate retransmission per status event

This method resends the right tile every time `onDeviceStatusChanged()` is called.
The latest values ​​are maintained, but BLE image transmission may occur without notice for battery indication.
It happens. This is excluded as it may unnecessarily disrupt the approved fast scrolling behavior.

## Page content

### 1. OVERVIEW

The existing content, which was centered on traffic news, is changed to a summary status board.

- G2 or R1 battery returned by SDK
- Whether to charge
- Today’s TODO count and completed count
- Current weather summary

### 2. NEWS

Samples that looked like maps or subway conditions were removed, and what was clearly a general article title was removed.
Shows six short sample titles. Four in the upper right main text, lower right
Place two in the auxiliary area so that they do not overlap the tile border.

### 3. TODO

The three existing checkboxes are maintained. The ‘G2 + R1 CONNECTED’ connection status at the bottom is
Remove it and change it to `Completed today 1 / 3` progress.

### 4. NAVIGATION

The current ‘120m’, right turn, next intersection content is maintained as is.

## Clock

The clock is displayed in `HH:MM` format with seconds removed. Canvas supports app launch and scrolling
Since it is only redrawn, the display time is also updated at that moment. retransmitting tiles every second
A real-time second clock is not implemented because it can increase BLE load and battery consumption.

## Data flow

1. Connect to the Even app bridge.
2. Call `getDeviceInfo()` once.
3. If successful, the battery snapshot of a single device is reflected in OVERVIEW.
4. If it fails or there is no value, continue with `BATTERY --`.
5. First transmit four tiles.
6. Subsequent scrolling changes pages in the approved order and sends only the two tiles on the right.

Battery inquiry failure is not treated as HUD image transmission failure.

## Test

- Check whether the page order is `overview`, `news`, `todo`, and `navigation`.
- Check that the clock is `HH:MM` and does not include seconds.
- OVERVIEW shows actual battery, charging indicator, and unknown alternative text drawn
  Confirm.
- Check whether six general article titles are drawn in NEWS.
- Check that the connection status disappears in TODO and the progress is displayed.
- Verify that battery inquiry is performed before image encoding.
- Check whether transmission of the first four tiles continues even if the battery inquiry fails.
- Reversion of the existing `/hud-canvas` and the initial `2, 3, 4, 5`, scroll `3, 5` contracts.
  Keep testing.

## Out of range

- Real news API connection
- Real weather API connection
- Simultaneous enumeration of G2 and R1 batteries
- Automatic image retransmission for each device status event
- Real-time clock updated every second
