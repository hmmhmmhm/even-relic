import type { RefObject } from "react";
import { HUD_PAGES } from "./canvas-hud";
import type { HudControllerModes } from "./hud-controller-types";
import { translatePhone } from "./phone-i18n";
import type { PhoneLocale } from "./phone-types";

export function HudSurface({
  canvasRef,
  modes,
  locale,
}: {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly modes: HudControllerModes;
  readonly locale: PhoneLocale;
}) {
  const renderer = modes.fastCanvas
    ? "canvas-fast"
    : modes.layeredHybrid
      ? "hybrid-z"
      : modes.hybrid
        ? "hybrid"
        : modes.canvas
          ? "canvas"
          : modes.calibration
            ? "calibration"
            : "image";
  return (
    <section
      className="hud-frame"
      data-testid="hud-frame"
      dir="ltr"
      data-logical-size="576x288"
      data-renderer={renderer}
      data-layering={modes.layeredHybrid ? "explicit" : undefined}
      data-layout={modes.fastCanvas
        ? "static-left-dynamic-right"
        : modes.layeredHybrid ? "map-text-console" : undefined}
      data-update-tiles={modes.fastCanvas ? "2" : undefined}
      data-text-containers={modes.diagnostic ? "2" : "1"}
      data-image-containers={modes.diagnostic ? "1" : "4"}
      data-pages={modes.canvas || modes.hybrid ? HUD_PAGES.length : undefined}
      aria-label={translatePhone(locale, "hudRasterPreview")}
    >
      <canvas
        ref={canvasRef}
        width="576"
        height="288"
        dir="ltr"
        role="img"
        aria-label={translatePhone(locale, "hudGlassesFrame")}
      />
    </section>
  );
}
