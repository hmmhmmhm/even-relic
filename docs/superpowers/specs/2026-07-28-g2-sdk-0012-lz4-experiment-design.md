# G2 SDK 0.0.12 LZ4 transmission experiment design

Date: 2026-07-28

Status: Approved for custom implementation

## Target

SDK `0.0.11` verified on the current physical G2, and only the SDK is maintained while preserving the HUD.
Upgraded to `0.0.12`, the official LZ4 image transmission path is now in the four-tile Canvas HUD.
See if it improves transfer time and stability.

## Baseline

- remote preservation branch: `origin/feature/g2-ors-routing`
- Baseline commit: `90a9421`
- Base SDK: `0.0.11`
- Base build: `weather-icon-029`
- Transmission format: 288×144 PNG four tiles
- Overall transmission order: top right, bottom right, top left, bottom left
- Prohibit simultaneous transmission, prohibit loading of update requests, discard busy requests immediately

## Approach

### Adoption: Replace only SDK

Only the SDK version and experiment URL marker for `package.json`, lockfile, `app.json`
Change to `0.0.12`. Canvas encoding, tile size, transmission order, timeout,
The busy-drop policy does not change. Therefore, the differences observed in practice can be compared to the SDK
It can be attributed to the transmission path.

### Pending: Skip change tile

The effect is strong, but if applied at the same time as SDK replacement, the cause of the speed improvement cannot be isolated.
does not exist. After securing the practical results of `0.0.12`, proceed with a separate experiment.

### Pending: Canvas·Official Text Mix

The perceived speed of text screens can be improved the most, but the rendering structure
It changes. It is not included in this SDK compatibility gate.

## Compatibility and failure handling

- SDK dependencies are set exactly to `0.0.12` without range notation.
- Set `app.json.min_sdk_version` to the same version.
- Image update calls are serially `await` only within a single authorized refresh.
- Do not queue refresh events or retry failed requests.
- If `sendFailed`, a timeout, or WebView freeze occurs, the event fails.
  Finish it and leave it to the next user event.
- Experiment changes are not pushed remotely before physical G2 approval.

## Practical success conditions

1. The initial display of the app is completed normally in four tiles and both eyes.
2. Moving the dashboard page, entering/returning to the details screen, hiding/restoring works normally.
3. The transmission time for each tile for the same operation is shorter than the `0.0.11` standard or at least
   It doesn't get worse.
4. There is no continuous execution of `SENDFAILED`, input stop, WebView stop, or delayed updates.
5. In the diagnostic log, the transmission continues to be serial and the busy input remains immediately dropped.

## Automatic verification

- SDK·App minimum version·QR experiment marker fixation test
- `ImageRawDataUpdate` in JSON without changing caller input
  Testing the LZ4 contract to ensure that `compressMode: 2` is automatically added.
- Full Vitest serial run
- Serial execution of Sites Node tests
- TypeScript type inspection
- Vite production build
- Check Tailscale experiment URL HTTP 200
