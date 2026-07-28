# G2 design to skip tile transmission without change

Date: 2026-07-28

Status: Approved for custom implementation

## Target

Finally on glasses, while maintaining the proven PNG four-tile serial transfer in SDK `0.0.11`
Success If the transmitted tile and the new encoding result are exactly the same
Omit the `updateImageRawData` call.

## Selected method

Keep the last successful `Uint8Array` by tile ID and store the new encoding bytes and length and
Each byte is compared accurately.

- The dirty flag is excluded because all update callers must know exactly the changed area.
- Hashes reduce memory slightly, but are excluded because they require collision handling and separate calculations.
- Accurate comparison is the simplest, with only a maximum of four tiles and a small PNG size.
  no conflict

Canvas encoding is currently at the 20–55ms level, so perform it as is. can be from hundreds of ms
Focus on reducing only SDK image calls, which take seconds.

## Transport Rules

1. In the first display, the cache is empty, so all target tiles are transmitted.
2. After encoding, each tile is accurately compared with the last success byte.
3. If they are the same, do not call the SDK and leave `[TILE] <name> skipped · unchanged`.
4. If different, transmit serially one by one in the existing order.
5. Immediately after the SDK returns success, only the corresponding tile cache is replaced with new bytes.
6. Failure, exception, and timeout tiles do not change the cache.
7. The success tile cache is maintained even if other tiles fail after the first successful tile.
   In the next input, only the tiles that are not reflected in the actual glasses are sent back.
8. Even if one refresh is omitted, it is already the same screen, so it is normal completion and
   Handle with display commit.

## Hide and restore

Since the black tiles have different bytes than the current HUD, all four are transmitted. After success
The cache becomes a black tile, and the restoration HUD is also different from the black tile, so four more cards are needed.
Send. The existing policy of discarding external updates while hidden is maintained.

## Life cycle and memory

The cache is placed only inside the `transmitCanvas` instance. App effects are cleaned up or new
Creating a page instance also discards the cache, so you don't accidentally omit a new container.
No. Only store a maximum of four PNGs.

## Maintaining stability contract

- SDK `0.0.11`
- 288×144 PNG four tiles
- Overall sequence `3 → 5 → 2 → 4`
- Serial transmission inside one update
- Immediately discard busy requests
- Prevent retry of failed requests and wait queues
- 12 second time limit per tile

## Diagnostic log

When each refresh is completed, the actual number of SDK calls and number of omissions are left.

```text
[REFRESH] image refresh complete · sent 1 · skipped 1
```

In practice, repeated clock, battery, and location updates and same screen redraws
`skipped · unchanged` appears, and only the tiles whose screen has changed show the existing success log.
Make sure you leave it behind.

## Automatic testing

- First display sends all tiles
- SDK call omitted for identical tiles
- If only part of the change is made, only the changed tile is sent
- Failed tiles are sent again in the next independent event
- Partial success cache is maintained so success tiles are not sent redundantly.
- Black hiding and HUD restoration each transmit four tiles
- All SDK calls have a maximum concurrent execution count of 1
- No regression in existing busy-drop, timeout, page rollback, or detailed screen input
