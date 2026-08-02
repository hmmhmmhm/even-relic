# Sandevistan Phone Companion Design QA

Date: 2026-07-29

Final result: `passed`

## Comparison target

- Source visual truth: owner-provided Even app Home (`Image #1`) and Menu
  (`Image #3`) screenshots from the current design conversation.
- Local normalized sources:
  `docs/design/audit-2026-07-29/reference-even-home-402x667.png` and
  `docs/design/audit-2026-07-29/reference-even-menu-325x667.png`.
- Implementation:
  `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=visual-audit-036`.
- Home capture:
  `docs/design/audit-2026-07-29/01-home-ko.png`.
- Final detail capture:
  `docs/design/audit-2026-07-29/07-hud-layout-checkboxes-final-ko.png`.
- Full-view comparisons:
  `docs/design/audit-2026-07-29/home-comparison.png` and
  `docs/design/audit-2026-07-29/detail-comparison-final.png`.

The audit image folder is intentionally local-only because it contains the
owner-supplied Even app reference captures. It is excluded from Git rather than
republishing those reference screens.

## Normalization

- Browser CSS viewport: `402 × 667`.
- Browser capture density: `1×`; implementation pixels: `402 × 667`.
- Home source pixels: `1206 × 2000`; normalized to `402 × 667` at `3×`.
- Menu source pixels: `975 × 2000`; normalized without distortion to
  `325 × 667` and centered in a `402`-pixel comparison column.
- Theme: approved light Even-inspired phone theme.
- State: Korean System locale, Home and HUD layout detail. Live G2 data is
  unavailable in the standalone browser, so the preview shows its honest
  no-GPS/no-live-data state.

## Required fidelity surfaces

- **Typography:** The implementation uses a restrained system sans stack,
  matching the reference's neutral phone typography. Detail labels are
  intentionally larger than the dense source Menu for the owner's requested
  phone readability.
- **Spacing and rhythm:** The pale preview region, section break, two-column
  Home cards, narrow gutters, white detail list, and hairline row separation
  follow the source hierarchy. The large return card is an approved
  Sandevistan-specific navigation affordance.
- **Colors:** `#eeeeee` page, white cards, black primary copy/icons, gray
  secondary copy, and restrained borders remain within the approved grayscale
  target. No green tint, glow, or shadow bloom appears.
- **Assets:** Visible phone icons use the local Pixelarticons package. The HUD
  layout now uses real checked and unchecked package icons with corrected
  semantic mapping; no text glyph or handcrafted SVG substitute is used.
- **Copy:** Phone controls are localized. Dynamic data remains source content.
  The visible localized Back to Dashboard label is also the button's accessible
  name.

## Interaction and accessibility evidence

- Home cards, the breadcrumb, and the large return card expose semantic button
  roles and localized accessible names.
- The Home Canvas remains mounted across screen changes.
- Opening a detail from `window.scrollY = 383` resets the new screen to
  `window.scrollY = 0` before paint.
- The large return card successfully returns Home.
- HUD enablement buttons expose `aria-pressed`; ordering controls retain
  separate labels and 44-pixel targets.
- Browser inspection reported no page errors. Missing Flutter-handler warnings
  are expected in the standalone browser and do not occur inside the Even
  WebView bridge.
- Screenshot evidence cannot establish full screen-reader or contrast
  compliance; semantic component tests cover roles and accessible names.

## Comparison history

### Iteration 1 — inherited document scroll

- Finding: `P2`. Opening a detail from lower on Home preserved the old document
  scroll offset, moving the new return card above the visible viewport.
- Earlier evidence:
  `docs/design/audit-2026-07-29/03-hud-layout-detail-ko.png`.
- Fix: reset document scroll in a layout effect whenever the active phone
  screen changes.
- Post-fix evidence:
  `docs/design/audit-2026-07-29/04-language-detail-scroll-reset-ko.png` and
  `docs/design/audit-2026-07-29/05-hud-layout-detail-scroll-reset-ko.png`.

### Iteration 2 — weak HUD enablement affordance

- Finding: `P2`. HUD enablement depended on a small status word, while the
  reference provides a visible selection mark.
- Fix: add Pixelarticons checkbox state inside the full-row toggle target.
- Follow-up finding: the package's `checkbox` and `checkbox-on` filenames map
  opposite to their visible checked/empty shapes, so the first capture showed
  empty boxes for enabled pages.
- Intermediate evidence:
  `docs/design/audit-2026-07-29/06-hud-layout-checkboxes-ko.png`.
- Fix: keep semantic app names and swap the underlying package-icon mapping,
  correcting both HUD layout and phone TODO state icons.
- Post-fix evidence:
  `docs/design/audit-2026-07-29/07-hud-layout-checkboxes-final-ko.png` and
  `docs/design/audit-2026-07-29/detail-comparison-final.png`.

## Residual P3 differences

- Sandevistan uses slightly rounder detail cards and larger row text than the
  reference. These are intentional readability choices already approved for
  the companion.
- The Home content differs from Even's device utility cards because the eight
  Sandevistan cards map directly to this product's actual features.

No actionable `P0`, `P1`, or `P2` difference remains in the audited Home,
detail-navigation, or HUD-layout states.

## 2026-08-02 structural follow-up

The current Codex session exposed no controllable in-app browser. The phone
companion after the Ask AI addition therefore has not received a new
screenshot-based visual audit. The 2026-07-29 captures above remain evidence
only for the states and build they record.

Fresh source-level verification on 2026-08-02 covered the current companion:

- all nine Home destinations, including Ask AI, render as complete semantic
  card buttons;
- every Home card routes directly to its detail screen without an intermediate
  management menu, and the persistent HUD Canvas remains mounted;
- detail navigation exposes one text breadcrumb and one localized return card;
- Home retains two columns at the 320-pixel acceptance width, the approved
  neutral treatment, 8-pixel card radius, and no card shadow;
- reorder and phone TODO controls retain 44-pixel minimum targets; and
- Ask AI BYOK storage, local cost and conversation summaries, response pacing,
  MCP server storage, and localized phone copy remain covered by automated
  tests.

Verification commands:

```sh
npm test -- --run src/phone/PhoneCompanion.test.tsx \
  src/phone/AiScreen.test.tsx src/ai-i18n.test.ts \
  src/mcp-i18n.test.ts src/phone-i18n.test.ts
npx vitest run src/phone/phone-home-styles.test.mjs \
  --no-file-parallelism --maxWorkers=1
```

Result: 28 component and localization tests plus 7 CSS policy tests passed.
This follow-up does not establish current pixel fidelity, contrast, keyboard
focus visuals, or screen-reader behavior. Those checks remain pending until a
controllable in-app browser is available.
