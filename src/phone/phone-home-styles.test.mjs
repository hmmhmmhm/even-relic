import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./phone-home.css", import.meta.url), "utf8");

describe("Even-style phone HUD preview", () => {
  it("neutralizes the global green HUD overlay inside the phone preview", () => {
    expect(css).toContain(
      ".phone-home__preview-slot .hud-frame::after",
    );
    expect(css).toMatch(
      /\.phone-home__preview-slot \.hud-frame::after\s*\{[^}]*display:\s*none/s,
    );
  });

  it("uses a neutral low-contrast treatment without color blending", () => {
    expect(css).toMatch(
      /\.phone-home__preview-slot \.hud-frame canvas\s*\{[^}]*filter:\s*grayscale\(1\) invert\(1\) contrast\(0\.62\)/s,
    );
    expect(css).toMatch(
      /\.phone-home__preview-slot \.hud-frame canvas\s*\{[^}]*mix-blend-mode:\s*normal/s,
    );
  });
});
