# GitHub Repository Presentation Design

## Goal

Make the GitHub repository page accurately communicate what Sandevistan is,
what hardware it targets, and its current release status. The repository must
remain discoverable without implying endorsement by Even Realities or
availability through Even Hub.

## GitHub description

Set the repository description to:

> An unofficial, hardware-tested tactical HUD for Even Realities G2, built with
> React, TypeScript, Canvas, and the Even Hub SDK.

The description leads with the unofficial status, names the validated hardware,
and includes the main implementation technologies. It must not mention
Cyberpunk 2077 or imply that Sandevistan is an Even Realities product.

## Repository topics

Replace the repository topic set with:

- `even-realities`
- `even-realities-g2`
- `smart-glasses`
- `heads-up-display`
- `hud`
- `wearable`
- `augmented-reality`
- `typescript`
- `react`
- `vite`
- `canvas`
- `even-hub-sdk`

This set balances device, product category, platform, and implementation
keywords. It intentionally avoids broad or misleading terms such as
`cyberpunk-2077`, `official`, and `production-ready`.

## README warning

Add this GitHub alert immediately after the centered project tagline and before
the badge row:

```markdown
> [!WARNING]
> **Development status:** Sandevistan is still under active development and has not been officially published on Even Hub. Builds from this repository are experimental and intended for local testing on supported G2 hardware.
```

The warning must remain near the top so readers see the development and
distribution status before interpreting test badges or hardware-validation
claims.

## Scope and validation

- Modify only the README warning and GitHub repository metadata.
- Preserve all existing README badges, screenshots, and project copy.
- Keep repository documentation in English.
- Verify the GitHub alert syntax renders as a warning block.
- Run the repository copy check and whitespace validation serially.
- Read the repository metadata back from GitHub after updating it.
- Confirm the local `main` branch and `origin/main` point to the same commit
  after publication.
