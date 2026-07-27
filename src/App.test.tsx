// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  drawFast: vi.fn(),
  transmitFast: vi.fn(),
  waitForBridge: vi.fn(),
}));

vi.mock("./fast-canvas-hud", async (importOriginal) => ({
  ...await importOriginal<typeof import("./fast-canvas-hud")>(),
  drawFastCanvasHud: mocks.drawFast,
}));

vi.mock("./glasses", async (importOriginal) => ({
  ...await importOriginal<typeof import("./glasses")>(),
  transmitFastCanvas: mocks.transmitFast,
}));

vi.mock("@evenrealities/even_hub_sdk", async (importOriginal) => ({
  ...await importOriginal<typeof import("@evenrealities/even_hub_sdk")>(),
  waitForEvenAppBridge: mocks.waitForBridge,
}));

vi.mock("./live-dashboard", async (importOriginal) => ({
  ...await importOriginal<typeof import("./live-dashboard")>(),
  createLiveDashboardSession: mocks.createSession,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it("selects the dense Canvas HUD with the proven four-tile layout", () => {
    window.history.replaceState({}, "", "/hud-canvas");
    render(<App autoStart={false} />);

    const hud = screen.getByTestId("hud-frame");
    expect(screen.getByText(/576×288 · CANVAS HUD/)).toBeTruthy();
    expect(hud.dataset.renderer).toBe("canvas");
    expect(hud.dataset.textContainers).toBe("1");
    expect(hud.dataset.imageContainers).toBe("4");
    expect(hud.dataset.pages).toBe("4");
    expect(hud.dataset.layout).toBeUndefined();
    expect(screen.getByText(/SCROLL · 4 PAGES/)).toBeTruthy();
  });

  it("isolates the two-tile fast Canvas experiment", () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    render(<App autoStart={false} />);

    const hud = screen.getByTestId("hud-frame");
    expect(hud.dataset.renderer).toBe("canvas-fast");
    expect(hud.dataset.layout).toBe("static-left-dynamic-right");
    expect(hud.dataset.updateTiles).toBe("2");
    expect(screen.getByText(/CANVAS HUD · FAST 2-TILE/)).toBeTruthy();
    expect(screen.getByText(/LIVE DATA/)).toBeTruthy();
    expect(screen.queryByText(/STATIC MOCK/)).toBeNull();
    expect(screen.getByText(
      "날씨: Open-Meteo · 지도 데이터: OpenStreetMap contributors",
    )).toBeTruthy();
  });

  it("does not show live-data credits outside the fast route", () => {
    window.history.replaceState({}, "", "/hud-canvas");
    render(<App autoStart={false} />);

    expect(screen.queryByText(
      "날씨: Open-Meteo · 지도 데이터: OpenStreetMap contributors",
    )).toBeNull();
  });

  it("starts one live session after fast transport and cleans both up", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    let finishTransport!: (cleanup: () => void) => void;
    const transportCleanup = vi.fn();
    mocks.transmitFast.mockReturnValue(new Promise<() => void>((resolve) => {
      finishTransport = resolve;
    }));
    const bridge = {};
    mocks.waitForBridge.mockResolvedValue(bridge);
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledTimes(1));
    expect(mocks.waitForBridge).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();

    finishTransport(transportCleanup);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledTimes(1));
    expect(mocks.waitForBridge).toHaveBeenCalledTimes(1);
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      bridge,
      onUpdate: expect.any(Function),
    }));

    view.unmount();
    expect(session.dispose).toHaveBeenCalledTimes(1);
    expect(transportCleanup).toHaveBeenCalledTimes(1);
  });

  it("isolates the static Canvas plus native Text experiment", () => {
    window.history.replaceState({}, "", "/hud-hybrid");
    render(<App autoStart={false} />);

    const hud = screen.getByTestId("hud-frame");
    expect(screen.getByText(/STATIC CANVAS \+ NATIVE TEXT/)).toBeTruthy();
    expect(hud.dataset.renderer).toBe("hybrid");
    expect(hud.dataset.textContainers).toBe("1");
    expect(hud.dataset.imageContainers).toBe("4");
    expect(hud.dataset.pages).toBe("4");
    expect(hud.dataset.layout).toBeUndefined();
  });

  it("isolates the explicit z-order hybrid experiment", () => {
    window.history.replaceState({}, "", "/hud-hybrid-z");
    render(<App autoStart={false} />);

    const hud = screen.getByTestId("hud-frame");
    expect(screen.getByText(
      /STATIC CANVAS \+ NATIVE TEXT \+ Z-ORDER/,
    )).toBeTruthy();
    expect(hud.dataset.renderer).toBe("hybrid-z");
    expect(hud.dataset.layering).toBe("explicit");
    expect(hud.dataset.textContainers).toBe("1");
    expect(hud.dataset.imageContainers).toBe("4");
    expect(hud.dataset.pages).toBe("4");
    expect(hud.dataset.layout).toBe("map-text-console");
  });
});
