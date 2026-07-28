# G2 representative weather icon design

Date: 2026-07-28

Status: Approved for custom implementation

## Target

You can recognize the current weather before the text in the Weather dashboard and full screen details.
Display a large 1-bit representative icon so that

## Visual rules

- Drawing directly with Canvas path without using external images and font icons
- Retains G2's black, white, gray palette and angular tactical HUD style
- Do not use blur, shadow, glow, or anti-aliasing-dependent effects.
- Dashboard icon approximately 72px, full screen detailed icon approximately 104px
- Icons do not overlap with temperature, condition, feeling, humidity, precipitation, and wind text.

## Weather Code Mapping

- `0`: sun
- `1–2`: sun and clouds
- `3`: clouds
- `45–48`: Fog
- `51–67`, `80–82`: rain
- `71–77`, `85–86`: snow
- Other `95–99`: Thunderstorms

The shapes are octagonal sun, stepped clouds, parallel raindrops, cross snowflakes, and lightning.
Use geometric shapes with distinct outlines even at low resolution, such as polygons.

## Status handling

For fresh and stale data, an icon corresponding to the weather code is displayed. loading and
unavailable does not display an icon to avoid implying incorrect weather, and
Keep only the status text.

## Test

- Icon type mapping for all Open-Meteo code groups
- Creation of Canvas path for each icon
- Call icons to correct size and location in Weather dashboard and details
- Icon not called during loading and unavailable
- No regression in existing page order, text content, input direction and update rules
