# G2 hybrid z-order backport experimental design

## Background and practical evidence

`/hud-hybrid` first creates four canvas backgrounds without text in SDK `0.0.10`.
Transmit, and update the full screen Text container ID 1 at the end. In actual G2
Only the Canvas layout was visible and the text was not visible as usual. Close system
Text appears when you open the panel, and disappears again as soon as you cancel the panel.

This result does not mean that the Text transfer or glyph rendering failed, but rather that the Text is
It shows that it is synthesized after the container. At the end, `textContainerUpgrade()`
The calling order does not change the container's screen layer order.

Official SDK `0.0.12` added `zOrderIndex` to List, Text and Image. same
If even one container on the page uses this value, all containers will have a different value.
It must have, and the larger the value, the sooner it is displayed. However, image LZ4 in `0.0.12`
Sending is currently confirmed as ‘SENDFAILED’ on the Even app and G2.

The TypeScript type in SDK `0.0.10` does not have `zOrderIndex`, but it does have a model constructor and
`toJson()` does not remove unknown fields. In local serialization check
Text, Image and `zOrderIndex` injected into the start page JSON have all been preserved.

## Target

Successful SDK `0.0.10` to container JSON while maintaining image transfer protocol
Specify only `zOrderIndex` to ensure that native text is visible on the Canvas image.
Judge.

Do not change `/hud-hybrid`, which preserves the existing `/hud-canvas` and the failure cause.
No. The new A/B path is `/hud-hybrid-z`.

## Layer contract

The new route's start page and reconfiguration page are unique to all five containers.
Specify the layer number.

| container | ID | layer |
|---|---:|---:|
| Top left Canvas image | 2 | 1 |
| Top right Canvas image | 3 | 2 |
| Bottom left Canvas image | 4 | 3 |
| Bottom right Canvas image | 5 | 4 |
| Full screen event Text | 1 | 5 |

Text is placed before the four images using the largest value of 5. The number is on the page
They are all unique, and image tiles do not overlap, so the relative order of 1–4 is
Does not affect shape.

`zOrderIndex` is explicitly set to the `0.0.10` model instance without increasing the SDK version.
Inject. If all five values ​​are not left in the result of `toJson()` on the start page,
The automatic test must fail before transfer to the actual device.

## Path and data flow

`/hud-hybrid-z` reuses the existing hybrid background and four-page text.

1. Create a start page with five containers with specified layers.
2. Serially transmit image IDs 2–5 using the existing `0.0.10` `ImageRawDataUpdate`.
3. After all four images are successful, update the `OVERVIEW` phrase in Text ID 1.
4. Down and up scrolling only updates the text once in the existing Promise queue.
5. Double-clicking exits the page as before.

The browser Canvas preview continues to show only a static background. Layer judgment is real
Available only with Even app and G2.

## Code isolation

The contract for creating existing pages without layers is left as is. The new page generator is
Expose it as a separate entry point like `createLayeredGlassesPage()`, and use it as a common internal
Only the creation logic is reused.

Hybrid transmission's image serialization, text conversion queue, and event processing are shared, but
Select New Path Only Layer Page Generator. `/hud-hybrid` accidentally
Fix it with a regression test to see if `zOrderIndex` is not received.

## Error handling

- If the start page is `invalid`, it is reconstructed once using the same layer number.
- If reconstruction fails, layer page reconstruction failure is displayed in the progress status.
- If the image is `SENDFAILED`, the existing error will be maintained to determine which tile failed.
- If Text update is `false`, existing native Text errors are maintained.
- Only `/hud-hybrid-z` will fail if the host does not understand `zOrderIndex`,
  `/hud-canvas` and `/hud-hybrid` remain as comparison and recovery paths.

It does not add automatic retries or SDK replacement. The variable in this experiment is the container
There must be only one layer number.

## Automatic testing

- `[1, 2, 3, 4, 5]` exists without duplication in the serialized JSON of the layer page.
- The layer of Text ID 1 is 5 and is larger than all Image layers.
- There is no `zOrderIndex` in the existing `createGlassesPage()` JSON.
- Only `/hud-hybrid-z` selects the explicit layer mode.
- The first image transmission is once for each ID 2–5 and there are no additional transmissions.
- Initial and scroll text updates are each performed once.
- SDK, app manifest and QR metadata continue to be `0.0.10`.
- There is no `compressMode` in `ImageRawDataUpdate.toJson()`.

## Judgment of practical equipment

The build identifier is `hybrid-zorder-006`.

```text
http://100.96.68.73:4173/hud-hybrid-z?sdk=0.0.10&build=hybrid-zorder-006
```

The following items are judged in actual G2.

- [ ] Native text is visible on the Canvas layout even without a close panel.
- [ ] Canvas frame and map lines are visible behind the text.
- [ ] Even if you open and cancel the close panel, the text display status does not change.
- [ ] `Line 2 operating normally`, `turn right →`, `[ ]`, `[x]` are read.
- [ ] When scrolling down or up, the text changes at once without resending the image.
- [ ] All four images are sent without `SENDFAILED`.
- [ ] The same layout and text are visible on both sides.

When text is displayed normally, explicit layer contract is used as the default method for hybrid HUD.
You can get promoted. If the page is `invalid` or the image is `SENDFAILED` again
The backport logs the existing Canvas HUD as not supported on the current host.
Remain as default candidate.
