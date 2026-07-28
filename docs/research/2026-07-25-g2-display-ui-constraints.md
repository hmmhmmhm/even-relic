# G2 screen freedom and basic components

The survey base date is 2026-07-25, and the latest public SDK version is `@evenrealities/even_hub_sdk` 0.0.12.

## Conclusion

The Even Hub WebView on the phone and the glasses screen are separate. A phone screen can be created with plain HTML, CSS, and TypeScript, but its DOM is not mirrored on the glasses. Text, List, and Image containers are transmitted to G2 through the SDK bridge.

## Display constraints

| Item | pharmaceutical |
| --- | --- |
| canvas | 576 x 288, upper left origin |
| color | 4-bit, 16 levels green |
| background | Black pixels are turned off and reality is reflected |
| Placement | Absolute coordinates, no CSS or DOM |
| full container | Up to 12 per page |
| Text/List | Total up to 8 |
| Image | Up to 4 |
| input | One Text or List must have `isEventCapture: 1` |
| layer | Native `zOrderIndex` support since SDK 0.0.12 |

## Basic elements

### Text

- Supports automatic line breaks and explicit line breaks.
- There are no font, size, thickness, italics, or alignment properties that the app can select.
- `textContainerUpgrade` updates without page reconfiguration, suitable for time, STT and sensor number.
- Up to 1,000 characters per container for startup and page reorganization, and up to 2,000 characters for in-place updates.

### List

- Firmware handles scrolling and selection display.
- The number of items is 1 to 20, and the item string can be up to 64 characters.
- You cannot set styles, heights, and dividers for each item.
- Changes to content require page reconfiguration, which may cause it to blink briefly.

### Image

- Displays a 4-bit grayscale bitmap.
- An image container has a width of 20 to 288 and a height of 20 to 144.
- After creation, `updateImageRawData` must be called separately.
- BLE transmission can take approximately 0.5 to 2 seconds, so it is not suitable for multi-FPS animation.
- It is appropriate to update the minimap only when the travel distance or direction threshold is exceeded.

## Native widget not provided

Maps, charts, gauges, compasses, 3D scenes, cards, tabs, grids, buttons and news tickers are not provided. It must be expressed using a combination of text symbols, borders, and bitmaps.

## Korean glyphs

When counting the built-in font table of the official text measurement package `@evenrealities/pretext` 0.1.4, there is width information for 2,780 characters out of 11,172 complete Korean characters. All of the following HUD terms are included:

`Time`, `Minimap`, `Map`, `Place Name`, `Volume`, `Voice Recognition`, `Direction Angle`, `Acceleration`, `Quest`, `News`, `Current Location`, `Seoul Metropolitan City`, `South Korea`

Since it does not support the entire Korean language, actual news and proper nouns must be verified in Glasses. Missing glyphs are considered an alternative path that creates a bitmap of only that string.

## Apply to Sandevistan

| Information | Recommended Elements |
| --- | --- |
| Time, place name | Text |
| Minimap | Image |
| dB and level bar | Text and supported block characters |
| STT | Text |
| Direction and acceleration | Text number |
| Current Quest | Text |
| All TODO and News | List on separate page |

The final dynamic HUD is likely to have the above hybrid configuration. However, the first actual device information density
In verification, the entire screen is sent as a raster rather than using native text.

### First practical raster test

```text
Selected 1792 x 896 cyan
  → Reduce to 576 x 288 in WebView Canvas
  → Split into four 288 x 144 PNG sheets
  → Sequential transfer to four Image containers
```

- All visible information is in the image.
- One blank Text container is the input to satisfy `isEventCapture: 1`
  It is just a layer and is not displayed on the screen.
- Your Image container uses all of the SDK image budget.
- Image transmission must be serialized and may take several seconds to complete the entire screen.
- The goal is not animation performance, but font size, contrast,
  This is to check the peripheral placement and central visual field margin.
- Time that changes frequently after seeing actual device results, only STT and sensor numbers are native
  Decide whether to return to text.

## Source

- [Even Hub G2 Glasses UI](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/glasses-ui/SKILL.md)
- [Even Hub G2 Design Guidelines](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/design-guidelines/SKILL.md)
- [Even Hub official templates](https://github.com/even-realities/evenhub-templates)
- [Official image template](https://github.com/even-realities/evenhub-templates/tree/main/image)
- [Even Hub SDK on npm](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [EvenHub Simulator on npm](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Pretext on npm](https://www.npmjs.com/package/@evenrealities/pretext)
