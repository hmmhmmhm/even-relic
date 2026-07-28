# Sandevistan HUD design criteria

## Selected direction

The first prototype uses `selected-peripheral-focus.png` as the visual reference.

- The central field of view is mostly empty.
- Place the time and place in the upper left corner.
- The direction is placed at the top center.
- The minimap is placed at the bottom left.
- Audio and acceleration are stacked on the right.
- STT is placed at the bottom center, and current quests and news are placed at the bottom right.

## Differences tailored to the actual G2

The generated draft is an image for direction finding. The implementation applies the following hardware constraints more strictly:

- The logical screen is 576 x 288.
- Black is a pixel that is turned off and is an area where the real environment is reflected.
- The only basic elements that can be uploaded to glasses are Text, List, and Image.
- One page can contain up to 8 Text/List, up to 4 Images, and up to 12 total.
- Custom fonts, font size, thickness, and alignment cannot be used.
- Images can be up to 288 x 144 and are unsuitable for frequent updates.

## Prototype scope

This version only evaluates the density and shape of the HUD. Time, map, location, dB, STT, direction, acceleration, quest and news are all static mockup data.
