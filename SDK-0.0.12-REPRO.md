# Even Hub SDK 0.0.12 G2 image send reproduction

This branch preserves the application state used when a physical Even
Realities G2 returned `sendFailed` on the first image update with Even Hub SDK
0.0.12.

## Environment

- `@evenrealities/even_hub_sdk`: exactly `0.0.12`
- `app.json` `min_sdk_version`: `0.0.12`
- Display: four 288×144 image containers covering 576×288
- Encoding: standard browser-generated PNG
- Full-frame send order: container IDs `3 → 5 → 2 → 4`
- Scheduling: strictly sequential
- No parallel image send, pending refresh queue, merge, retry, or catch-up work
- Per-tile timeout: 12 seconds

The corresponding SDK 0.0.11 application uses the same Canvas renderer, PNG
encoder, image containers, update call, and sequential scheduler.

## Reproduction

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the reproduction build:

   ```bash
   npm run dev -- --host 0.0.0.0 --port 4177 --strictPort
   ```

3. Open this route through Even Hub on a paired G2:

   ```text
   http://localhost:4177/hud-canvas-fast?sdk=0.0.12&build=sdk-0012-repro-033
   ```

   If Even Hub is running on another device, replace `localhost` with a LAN
   address of the development computer that the device can reach.

4. Observe the first `updateImageRawData` result in `WEBVIEW TRACE`.

## Image update call

The caller supplies the image container identity and the browser-generated PNG
bytes:

```ts
await bridge.updateImageRawData(new ImageRawDataUpdate({
  containerID: tile.id,
  containerName: tile.name,
  imageData: bytes,
}));
```

The caller does not set a compression mode.

## Actual result with SDK 0.0.12

The four PNG tiles encode successfully. The first tile, `relicTR` (container
ID 3), returns `sendFailed` in approximately 7ms. No image appears on either
lens and the remaining tiles are not sent.

```text
[15:35:46.275] [ENCODE] start · 4 tiles
[15:35:46.330] [ENCODE] complete · 4 tiles · 55ms
[15:35:46.330] [TILE] relicTR start · 1/4
[15:35:46.337] [ERROR] relicTR failed · sendFailed · 7ms
[15:35:46.338] [ERROR] app startup failed · Error
```

## Control result with SDK 0.0.11

The same page, PNG encoder, image update call, tile geometry, and strictly
sequential scheduler display successfully on the same physical G2 when the SDK
is pinned to 0.0.11.

## Observed serialization difference

In SDK 0.0.12, `ImageRawDataUpdate.toJson()` automatically includes
`compressMode: 2`. The SDK 0.0.11 payload does not contain that field.

This is an observation for investigation, not a claim that compression is the
confirmed root cause. We would appreciate confirmation of the expected
compression and bridge contract for `updateImageRawData` in SDK 0.0.12.

## Relevant source

- [Serial image transport](src/fast-canvas-transport.ts)
- [Canvas tiling and PNG encoding](src/g2-canvas.ts)
- [SDK and serialized-payload contract](src/sdk-version.test.ts)
- [Even Hub app manifest](app.json)
- [Exact SDK dependency and local reproduction URL](package.json)
- [Physical hardware record](docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md)
