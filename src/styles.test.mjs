import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("WebView preview treatment", () => {
  it("uses a flat green composition without glow", () => {
    expect(css).toContain(".hud-frame::after");
    expect(css).toContain("background: #91ff73");
    expect(css).toContain("mix-blend-mode: multiply");
    expect(css).toContain("box-shadow: none");
    expect(css).not.toContain("radial-gradient");
    expect(css).not.toContain("0 0 50px");
  });
});
