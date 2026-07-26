// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("RELIC peripheral HUD", () => {
  it("uses one 576 by 288 canvas as the only visible HUD surface", () => {
    render(<App autoStart={false} />);

    const hud = screen.getByTestId("hud-frame");
    const canvas = screen.getByRole("img", { name: "RELIC HUD 안경 프레임" });

    expect(hud.getAttribute("data-logical-size")).toBe("576x288");
    expect(hud.dataset.textContainers).toBe("1");
    expect(hud.dataset.imageContainers).toBe("4");
    expect(canvas.tagName).toBe("CANVAS");
    expect(canvas.getAttribute("width")).toBe("576");
    expect(canvas.getAttribute("height")).toBe("288");
  });

  it("keeps mock information inside the raster instead of native text", () => {
    render(<App autoStart={false} />);
    expect(screen.queryByText("14:37")).toBeNull();
    expect(screen.queryByText("다음 교차로에서 우회전")).toBeNull();
  });

  it("selects the official raw-byte diagnostic from its dedicated path", () => {
    window.history.replaceState({}, "", "/diagnostic-v6");
    render(<App autoStart={false} />);

    const hud = screen.getByTestId("hud-frame");
    expect(screen.getByText(/OFFICIAL SAMPLE\.PNG · RAW BYTES/)).toBeTruthy();
    expect(hud.dataset.textContainers).toBe("2");
    expect(hud.dataset.imageContainers).toBe("1");
  });

  it("selects the click-triggered BMP diagnostic from the v10 path", () => {
    window.history.replaceState({}, "", "/diagnostic-v10");
    render(<App autoStart={false} />);

    expect(screen.getByText(/1-BIT BMP · CLICK TO SEND/)).toBeTruthy();
  });

  it("selects the four-tile maximum-boundary calibration route", () => {
    window.history.replaceState({}, "", "/calibration-max");
    render(<App autoStart={false} />);

    const hud = screen.getByTestId("hud-frame");
    expect(screen.getByText(/576×288 MAX BOUNDARY/)).toBeTruthy();
    expect(hud.dataset.textContainers).toBe("1");
    expect(hud.dataset.imageContainers).toBe("4");
  });
});
