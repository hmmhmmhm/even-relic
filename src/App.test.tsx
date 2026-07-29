// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { OsEventTypeList } from "@evenrealities/even_hub_sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";
import { diagnosticLogger } from "./diagnostic-log";

type RefreshTarget = "left" | "right" | "right-top" | "all";
type FastInput =
  | "tap"
  | "double-tap"
  | "scroll-next"
  | "scroll-previous";
type FastInputResult = "unhandled" | "consume" | "redraw";
type FastTestOptions = {
  readonly beforeExternalRefresh?: () => void | Promise<void>;
  readonly onBattery?: (battery: {
    readonly label: "G1" | "G2" | "R1";
    readonly level?: number;
    readonly charging?: boolean;
  } | undefined) => void;
  readonly onDisplayCommitted?: (minute: number) => void;
  readonly onInput?: (
    input: FastInput,
  ) => FastInputResult | Promise<FastInputResult>;
  readonly onRawEvent?: (event: {
    readonly count: number;
    readonly hidden: boolean;
    readonly sysEventType?: OsEventTypeList;
    readonly textEventType?: OsEventTypeList;
    readonly eventSource?: number;
  }) => void;
  readonly onRefreshReady?: (
    request: (target: RefreshTarget) => void,
  ) => void;
};
type SessionTestOptions = {
  readonly canRefreshNews?: () => boolean;
  readonly onUpdate: (update: {
    readonly state: LiveDashboardState;
    readonly target: RefreshTarget;
  }) => void;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function fastOptions(): FastTestOptions {
  const calls = mocks.transmitFast.mock.calls as unknown as Array<
    [unknown, unknown, unknown, FastTestOptions]
  >;
  return calls[0][3];
}

function sessionOptions(): SessionTestOptions {
  const calls = mocks.createSession.mock.calls as unknown as Array<
    [SessionTestOptions]
  >;
  return calls[0][0];
}

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  drawDetail: vi.fn(),
  drawFast: vi.fn(),
  drawFullscreen: vi.fn(),
  getRoutingStatus: vi.fn(),
  minuteStart: vi.fn(),
  searchDestinations: vi.fn(),
  transmitFast: vi.fn(),
  waitForBridge: vi.fn(),
}));

vi.mock("./fast-detail-hud", async (importOriginal) => ({
  ...await importOriginal<typeof import("./fast-detail-hud")>(),
  drawFastDetailHud: mocks.drawDetail,
}));

vi.mock("./fast-canvas-hud", async (importOriginal) => ({
  ...await importOriginal<typeof import("./fast-canvas-hud")>(),
  drawFastCanvasHud: mocks.drawFast,
}));

vi.mock("./fast-map", async (importOriginal) => ({
  ...await importOriginal<typeof import("./fast-map")>(),
  drawFastFullscreenMap: mocks.drawFullscreen,
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

vi.mock("./minute-refresh", () => ({
  startMinuteRefresh: mocks.minuteStart,
}));

vi.mock("./routing", async (importOriginal) => ({
  ...await importOriginal<typeof import("./routing")>(),
  getRoutingStatus: mocks.getRoutingStatus,
  searchDestinations: mocks.searchDestinations,
}));

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "",
    measureText: (value: string) => ({
      width: [...value].length * 10,
    }),
  } as unknown as CanvasRenderingContext2D);
  mocks.createSession.mockReset();
  mocks.drawDetail.mockReset();
  mocks.drawFast.mockReset();
  mocks.drawFullscreen.mockReset();
  mocks.getRoutingStatus.mockReset();
  mocks.getRoutingStatus.mockResolvedValue({ enabled: false });
  mocks.minuteStart.mockReset();
  mocks.searchDestinations.mockReset();
  mocks.searchDestinations.mockResolvedValue([]);
  mocks.transmitFast.mockReset();
  mocks.waitForBridge.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("SANDEVISTAN peripheral HUD", () => {
  it("uses one 576 by 288 canvas as the only visible HUD surface", () => {
    render(<App autoStart={false} />);

    const hud = screen.getByTestId("hud-frame");
    const canvas = screen.getByRole("img", { name: "SANDEVISTAN HUD 안경 프레임" });

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
    expect(screen.queryByRole("banner", {
      name: "Sandevistan / Dashboard",
    })).toBeNull();
    expect(screen.getByRole("heading", {
      level: 2,
      name: "Dashboard",
    })).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Devices/ })).toBeTruthy();
    expect(screen.queryByText(/CANVAS HUD · FAST 2-TILE/)).toBeNull();
  });

  it("shows diagnostics only after opening Developer on the fast HUD", () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const fast = render(<App autoStart={false} />);
    expect(screen.queryByText("WEBVIEW TRACE")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Developer/ }));
    expect(screen.getByText("WEBVIEW TRACE")).toBeTruthy();
    fast.unmount();

    window.history.replaceState({}, "", "/hud-canvas");
    render(<App autoStart={false} />);
    expect(screen.queryByText("WEBVIEW TRACE")).toBeNull();
  });

  it("does not show live-data credits outside the fast route", () => {
    window.history.replaceState({}, "", "/hud-canvas");
    render(<App autoStart={false} />);

    expect(screen.queryByText(
      "날씨: Open-Meteo · 지도 데이터: OpenStreetMap contributors · 뉴스: SBS RSS · 개인·비상업",
    )).toBeNull();
  });

  it("renders the newest live snapshot before requesting its target refresh", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    const transportCleanup = vi.fn();
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return transportCleanup;
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);
    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledTimes(1));
    const newest: LiveDashboardState = {
      ...createInitialLiveDashboardState(),
      weather: {
        status: "fresh",
        fetchedAt: 1_800_000_000_000,
        value: {
          temperature: 30,
          apparentTemperature: 31,
          humidity: 67,
          windSpeed: 8,
          precipitationProbability: 20,
          weatherCode: 2,
          condition: "대체로 맑음",
        },
      },
    };

    sessionOptions().onUpdate({ state: newest, target: "right" });
    expect(requestRefresh).toHaveBeenCalledWith("right");
    await fastOptions().beforeExternalRefresh?.();
    expect(mocks.drawFast).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Date),
      "overview",
      { battery: undefined, live: newest, mapRadiusMeters: 650 },
    );
    view.unmount();
  });

  it("requests only the right-top tile on minute boundaries and stops on cleanup", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    const stopMinuteRefresh = vi.fn();
    let onMinute: ((minute: number) => void) | undefined;
    mocks.minuteStart.mockImplementation((callback: (minute: number) => void) => {
      onMinute = callback;
      return stopMinuteRefresh;
    });
    const transportCleanup = vi.fn();
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return transportCleanup;
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    expect(mocks.minuteStart).toHaveBeenCalledOnce();

    onMinute?.(1_234);
    expect(requestRefresh).toHaveBeenCalledWith("right-top");

    view.unmount();
    expect(stopMinuteRefresh).toHaveBeenCalledOnce();
  });

  it("checks due news each minute except while reading and checks on exit", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    let onMinute: ((minute: number) => void) | undefined;
    let navigate:
      | ((direction: "next" | "previous") => Promise<void>)
      | undefined;
    mocks.minuteStart.mockImplementation((callback: (minute: number) => void) => {
      onMinute = callback;
      return vi.fn();
    });
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      navigate = args[2] as typeof navigate;
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(vi.fn());
      return vi.fn();
    });
    mocks.waitForBridge.mockResolvedValue({});
    const refreshNewsIfDue = vi.fn();
    const session = {
      start: vi.fn(async () => undefined),
      refreshNewsIfDue,
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    expect(sessionOptions().canRefreshNews?.()).toBe(true);

    onMinute?.(1_234);
    expect(refreshNewsIfDue).toHaveBeenCalledOnce();

    await navigate?.("next");
    expect(await fastOptions().onInput?.("tap")).toBe("redraw");
    expect(sessionOptions().canRefreshNews?.()).toBe(false);
    onMinute?.(1_235);
    expect(refreshNewsIfDue).toHaveBeenCalledOnce();

    expect(await fastOptions().onInput?.("double-tap")).toBe("redraw");
    expect(sessionOptions().canRefreshNews?.()).toBe(true);
    expect(refreshNewsIfDue).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it("skips clock refresh when another transfer committed this minute", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    let onMinute: ((minute: number) => void) | undefined;
    mocks.minuteStart.mockImplementation((callback: (minute: number) => void) => {
      onMinute = callback;
      return vi.fn();
    });
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return vi.fn();
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    fastOptions().onDisplayCommitted?.(1_234);

    onMinute?.(1_234);
    expect(requestRefresh).not.toHaveBeenCalled();
    onMinute?.(1_235);
    expect(requestRefresh).toHaveBeenCalledOnce();
    expect(requestRefresh).toHaveBeenCalledWith("right-top");
    view.unmount();
  });

  it("does not retry one minute refresh in the same minute", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    let onMinute: ((minute: number) => void) | undefined;
    mocks.minuteStart.mockImplementation((callback: (minute: number) => void) => {
      onMinute = callback;
      return vi.fn();
    });
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return vi.fn();
    });
    mocks.waitForBridge.mockResolvedValue({});
    mocks.createSession.mockReturnValue({
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    });

    const view = render(<App />);
    await vi.waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    onMinute?.(1_235);
    onMinute?.(1_235);
    onMinute?.(1_235);

    expect(requestRefresh).toHaveBeenCalledOnce();
    expect(requestRefresh).toHaveBeenCalledWith("right-top");
    view.unmount();
  });

  it("traces fast HUD lifecycle without changing refresh behavior", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    diagnosticLogger.clear();
    const requestRefresh = vi.fn();
    let onMinute: ((minute: number) => void) | undefined;
    mocks.minuteStart.mockImplementation((callback: (minute: number) => void) => {
      onMinute = callback;
      return vi.fn();
    });
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return vi.fn();
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    fastOptions().onBattery?.({
      label: "G2",
      level: 78,
      charging: false,
    });
    await fastOptions().onInput?.("tap");
    sessionOptions().onUpdate({
      state: createInitialLiveDashboardState(),
      target: "right",
    });
    onMinute?.(1_234);
    const errorEvent = new ErrorEvent("error", {
      cancelable: true,
      error: new TypeError("private route destination"),
      message: "private route destination",
    });
    errorEvent.preventDefault();
    window.dispatchEvent(errorEvent);
    const rejection = new Event("unhandledrejection");
    Object.defineProperty(rejection, "reason", {
      value: new RangeError("private coordinate"),
    });
    window.dispatchEvent(rejection);
    view.unmount();

    const trace = diagnosticLogger.text();
    expect(trace).toContain("[APP] fast HUD effect start");
    expect(trace).toContain("[APP] transport start");
    expect(trace).toContain("[APP] transport ready");
    expect(trace).toContain("[APP] live bridge ready");
    expect(trace).toContain("[TIMER] heartbeat started");
    expect(trace).toContain("[TIMER] minute refresh");
    expect(trace).toContain("[INPUT] app tap");
    expect(trace).toContain("[LIVE] app update · right");
    expect(trace).toContain("[ERROR] window error · TypeError");
    expect(trace).toContain("[ERROR] unhandled rejection · RangeError");
    expect(trace).toContain("[APP] fast HUD effect cleanup");
    expect(trace).toContain("[TIMER] heartbeat stopped");
    expect(trace).not.toContain("private route destination");
    expect(trace).not.toContain("private coordinate");
    expect(requestRefresh).toHaveBeenCalledWith("right-top");
  });

  it("shows raw hidden input only in the phone status", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    mocks.transmitFast.mockImplementation(async () => vi.fn());
    mocks.waitForBridge.mockResolvedValue({});
    mocks.createSession.mockReturnValue({
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    });

    render(<App />);
    await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());

    fastOptions().onRawEvent?.({
      count: 7,
      hidden: true,
      sysEventType: undefined,
      textEventType: OsEventTypeList.DOUBLE_CLICK_EVENT,
      eventSource: 2,
    });

    await vi.waitFor(() => expect(screen.getByText(
      "숨김 입력 #7 · SYS - · TEXT 3 · SRC 2",
    )).toBeTruthy());
  });

  it("refreshes a visible overview battery change and retains it on other pages", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    const transportCleanup = vi.fn();
    let navigate:
      | ((direction: "next" | "previous") => Promise<void>)
      | undefined;
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      navigate = args[2] as typeof navigate;
      const options = args[3] as FastTestOptions;
      options.onBattery?.({
        label: "G2",
        level: 82,
        charging: false,
      });
      options.onRefreshReady?.(requestRefresh);
      return transportCleanup;
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());

    fastOptions().onBattery?.({
      label: "G2",
      level: 81,
      charging: false,
    });
    expect(requestRefresh).toHaveBeenLastCalledWith("right-top");

    requestRefresh.mockClear();
    await navigate?.("next");
    fastOptions().onBattery?.({
      label: "G2",
      level: 80,
      charging: true,
    });
    expect(requestRefresh).not.toHaveBeenCalled();

    await navigate?.("previous");
    expect(mocks.drawFast).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Date),
      "overview",
      {
        battery: { label: "G2", level: 80, charging: true },
        live: expect.any(Object),
        mapRadiusMeters: 650,
      },
    );
    view.unmount();
  });

  it("opens, zooms, and closes the fullscreen map from overview input", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    const transportCleanup = vi.fn();
    let navigate:
      | ((direction: "next" | "previous") => Promise<void>)
      | undefined;
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      navigate = args[2] as typeof navigate;
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return transportCleanup;
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    expect(await fastOptions().onInput?.("tap")).toBe("redraw");
    expect(mocks.drawFullscreen).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Object),
      650,
    );

    expect(await fastOptions().onInput?.("scroll-next")).toBe("redraw");
    expect(mocks.drawFullscreen).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Object),
      850,
    );

    expect(await fastOptions().onInput?.("double-tap")).toBe("redraw");
    expect(mocks.drawFast).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Date),
      "overview",
      expect.objectContaining({ mapRadiusMeters: 850 }),
    );
    expect(await fastOptions().onInput?.("double-tap")).toBe("unhandled");

    await navigate?.("next");
    mocks.drawFullscreen.mockClear();
    expect(await fastOptions().onInput?.("tap")).toBe("redraw");
    expect(mocks.drawFullscreen).not.toHaveBeenCalled();
    expect(mocks.drawDetail).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ mode: "news", newsIndex: 0, newsPage: 0 }),
    );
    view.unmount();
  });

  it("cycles keyless Weather fourth and keeps Navigation opt-in when routed", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    let navigate:
      | ((direction: "next" | "previous") => Promise<void>)
      | undefined;
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      navigate = args[2] as typeof navigate;
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return vi.fn();
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    await navigate?.("next");
    await navigate?.("next");
    await navigate?.("next");
    expect(mocks.drawFast).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Date),
      "weather",
      expect.any(Object),
    );

    expect(await fastOptions().onInput?.("tap")).toBe("redraw");
    expect(mocks.drawDetail).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ mode: "weather" }),
    );
    expect(await fastOptions().onInput?.("scroll-next")).toBe("consume");
    expect(await fastOptions().onInput?.("double-tap")).toBe("redraw");

    await navigate?.("next");
    expect(mocks.drawFast).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Date),
      "overview",
      expect.any(Object),
    );

    const routed: LiveDashboardState = {
      ...createInitialLiveDashboardState(),
      route: { status: "fresh" },
    };
    sessionOptions().onUpdate({ state: routed, target: "right" });
    await navigate?.("next");
    await navigate?.("next");
    await navigate?.("next");
    await navigate?.("next");
    expect(mocks.drawFast).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Date),
      "overview",
      expect.objectContaining({ live: routed }),
    );
    view.unmount();
  });

  it("refreshes only weather changes while Weather detail is open", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    let navigate:
      | ((direction: "next" | "previous") => Promise<void>)
      | undefined;
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      navigate = args[2] as typeof navigate;
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return vi.fn();
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);
    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());

    await navigate?.("next");
    await navigate?.("next");
    await navigate?.("next");
    await fastOptions().onInput?.("tap");
    requestRefresh.mockClear();

    const weather: LiveDashboardState = {
      ...createInitialLiveDashboardState(),
      weather: {
        status: "fresh",
        fetchedAt: 1,
        value: {
          temperature: 28,
          apparentTemperature: 30,
          humidity: 63,
          windSpeed: 8,
          precipitationProbability: 20,
          weatherCode: 0,
          condition: "맑음",
        },
      },
    };
    sessionOptions().onUpdate({ state: weather, target: "right" });
    expect(requestRefresh).toHaveBeenCalledWith("all");
    requestRefresh.mockClear();

    const news: LiveDashboardState = {
      ...weather,
      news: {
        status: "fresh",
        fetchedAt: 2,
        value: [{ id: "news", title: "새 기사" }],
      },
    };
    sessionOptions().onUpdate({ state: news, target: "right" });
    expect(requestRefresh).not.toHaveBeenCalled();
    await fastOptions().beforeExternalRefresh?.();
    expect(mocks.drawDetail).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ mode: "weather", live: news }),
    );
    view.unmount();
  });

  it("opens news and TODO detail decks and applies a selected TODO toggle", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    let navigate:
      | ((direction: "next" | "previous") => Promise<void>)
      | undefined;
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      navigate = args[2] as typeof navigate;
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return vi.fn();
    });
    mocks.waitForBridge.mockResolvedValue({});
    let todoState = createInitialLiveDashboardState();
    const toggleTodo = vi.fn(async (index: number) => {
      const items = todoState.todos.value!.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, completed: !item.completed }
          : item
      );
      todoState = {
        ...todoState,
        todos: {
          status: "fresh",
          value: items,
        },
      };
      sessionOptions().onUpdate({ state: todoState, target: "right" });
      return true;
    });
    const session = {
      start: vi.fn(async () => undefined),
      toggleTodo,
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    await navigate?.("next");
    expect(await fastOptions().onInput?.("tap")).toBe("redraw");
    expect(mocks.drawDetail).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ mode: "news", newsIndex: 0 }),
    );
    expect(await fastOptions().onInput?.("double-tap")).toBe("redraw");

    await navigate?.("next");
    expect(await fastOptions().onInput?.("tap")).toBe("redraw");
    expect(await fastOptions().onInput?.("scroll-next")).toBe("redraw");
    expect(await fastOptions().onInput?.("tap")).toBe("redraw");
    expect(session.toggleTodo).toHaveBeenCalledOnce();
    expect(session.toggleTodo).toHaveBeenCalledWith(1);
    expect(mocks.drawDetail).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({
        mode: "todo",
        todoIndex: 1,
        live: expect.objectContaining({
          todos: expect.objectContaining({
            value: expect.arrayContaining([
              expect.objectContaining({
                id: "umbrella",
                completed: true,
              }),
            ]),
          }),
        }),
      }),
    );

    expect(await fastOptions().onInput?.("tap")).toBe("redraw");
    expect(session.toggleTodo).toHaveBeenCalledTimes(2);
    expect(mocks.drawDetail).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({
        live: expect.objectContaining({
          todos: expect.objectContaining({
            value: expect.arrayContaining([
              expect.objectContaining({
                id: "umbrella",
                completed: false,
              }),
            ]),
          }),
        }),
      }),
    );

    toggleTodo.mockResolvedValueOnce(false);
    const drawsBeforeRejectedToggle = mocks.drawDetail.mock.calls.length;
    expect(await fastOptions().onInput?.("tap")).toBe("consume");
    expect(mocks.drawDetail).toHaveBeenCalledTimes(drawsBeforeRejectedToggle);
    view.unmount();
  });

  it("refreshes only data visible in the open news detail", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    let navigate:
      | ((direction: "next" | "previous") => Promise<void>)
      | undefined;
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      navigate = args[2] as typeof navigate;
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return vi.fn();
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      toggleTodo: vi.fn(async () => true),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);
    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    await navigate?.("next");
    await fastOptions().onInput?.("tap");
    requestRefresh.mockClear();

    const weather: LiveDashboardState = {
      ...createInitialLiveDashboardState(),
      weather: {
        status: "fresh",
        fetchedAt: 1,
        value: {
          temperature: 28,
          apparentTemperature: 29,
          humidity: 60,
          windSpeed: 2,
          precipitationProbability: 10,
          weatherCode: 1,
          condition: "맑음",
        },
      },
    };
    sessionOptions().onUpdate({ state: weather, target: "right" });
    expect(requestRefresh).not.toHaveBeenCalled();

    const news: LiveDashboardState = {
      ...weather,
      news: {
        status: "fresh",
        fetchedAt: 2,
        value: [{
          id: "news-1",
          title: "새 뉴스",
          summary: "새 RSS 요약",
        }],
      },
    };
    sessionOptions().onUpdate({ state: news, target: "right" });
    expect(requestRefresh).toHaveBeenCalledWith("all");
    await fastOptions().beforeExternalRefresh?.();
    expect(mocks.drawDetail).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ mode: "news", live: news }),
    );
    view.unmount();
  });

  it("routes only map-side live refreshes while fullscreen", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const requestRefresh = vi.fn();
    const transportCleanup = vi.fn();
    let onMinute: ((minute: number) => void) | undefined;
    mocks.minuteStart.mockImplementation((callback: (minute: number) => void) => {
      onMinute = callback;
      return vi.fn();
    });
    mocks.transmitFast.mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as FastTestOptions;
      options.onRefreshReady?.(requestRefresh);
      return transportCleanup;
    });
    mocks.waitForBridge.mockResolvedValue({});
    const session = {
      start: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalledOnce());
    await fastOptions().onInput?.("tap");
    await fastOptions().onInput?.("scroll-next");
    requestRefresh.mockClear();

    const moved: LiveDashboardState = {
      ...createInitialLiveDashboardState(),
      location: {
        status: "fresh",
        value: {
          coordinate: { latitude: 37.557, longitude: 126.923 },
          source: "live",
        },
      },
    };
    sessionOptions().onUpdate({ state: moved, target: "left" });
    expect(requestRefresh).toHaveBeenCalledWith("all");
    await fastOptions().beforeExternalRefresh?.();
    expect(mocks.drawFullscreen).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      moved,
      850,
    );

    requestRefresh.mockClear();
    const routed: LiveDashboardState = {
      ...moved,
      route: {
        status: "fresh",
        fetchedAt: 1,
        value: {
          destinationName: "서울역",
          geometry: [
            moved.location.value!.coordinate,
            { latitude: 37.5547, longitude: 126.9707 },
          ],
          maneuvers: [],
          activeManeuverIndex: 0,
          remainingDistance: 4_380,
          profile: "foot-walking",
        },
      },
    };
    sessionOptions().onUpdate({ state: routed, target: "all" });
    expect(requestRefresh).toHaveBeenCalledWith("all");
    await fastOptions().beforeExternalRefresh?.();
    expect(mocks.drawFullscreen).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      routed,
      850,
    );

    requestRefresh.mockClear();
    const weather: LiveDashboardState = {
      ...routed,
      weather: {
        status: "fresh",
        fetchedAt: 1,
        value: {
          temperature: 28,
          apparentTemperature: 29,
          humidity: 60,
          windSpeed: 5,
          precipitationProbability: 10,
          weatherCode: 1,
          condition: "맑음",
        },
      },
    };
    sessionOptions().onUpdate({ state: weather, target: "right" });
    fastOptions().onBattery?.({
      label: "G2",
      level: 79,
      charging: false,
    });
    onMinute?.(1_234);
    expect(requestRefresh).not.toHaveBeenCalled();

    await fastOptions().onInput?.("double-tap");
    expect(mocks.drawFast).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Date),
      "overview",
      {
        battery: { label: "G2", level: 79, charging: false },
        live: weather,
        mapRadiusMeters: 850,
      },
    );
    view.unmount();
  });

  it("does not start bridge or session after unmounting during transport", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const transport = deferred<() => void>();
    const transportCleanup = vi.fn();
    mocks.transmitFast.mockReturnValue(transport.promise);
    const view = render(<App />);
    await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledTimes(1));

    view.unmount();
    view.unmount();
    transport.resolve(transportCleanup);
    await vi.waitFor(() => expect(transportCleanup).toHaveBeenCalledTimes(1));

    expect(mocks.waitForBridge).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("disposes transport and skips session after unmounting during bridge wait", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const transportCleanup = vi.fn();
    const bridge = deferred<object>();
    mocks.transmitFast.mockResolvedValue(transportCleanup);
    mocks.waitForBridge.mockReturnValue(bridge.promise);
    const view = render(<App />);
    await vi.waitFor(() => expect(mocks.waitForBridge).toHaveBeenCalledTimes(1));

    view.unmount();
    view.unmount();
    expect(transportCleanup).toHaveBeenCalledTimes(1);
    bridge.resolve({});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(transportCleanup).toHaveBeenCalledTimes(1);
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

  it("checks routing once and wires phone destination controls to the live session", async () => {
    window.history.replaceState({}, "", "/hud-canvas-fast");
    const transportCleanup = vi.fn();
    mocks.transmitFast.mockResolvedValue(transportCleanup);
    mocks.waitForBridge.mockResolvedValue({});
    mocks.getRoutingStatus.mockResolvedValue({ enabled: true });
    const destination = {
      id: "venue.1",
      name: "서울역",
      label: "서울역, 서울특별시",
      coordinate: { latitude: 37.5547, longitude: 126.9707 },
    };
    mocks.searchDestinations.mockResolvedValue([destination]);
    const session = {
      start: vi.fn(async () => undefined),
      startRoute: vi.fn(async () => undefined),
      endRoute: vi.fn(async () => undefined),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    mocks.createSession.mockReturnValue(session);

    const view = render(<App />);
    fireEvent.click(await screen.findByRole("button", {
      name: /Navigation/,
    }));
    const textbox = await screen.findByRole("textbox", {
      name: "Destination",
    });
    expect(mocks.getRoutingStatus).toHaveBeenCalledOnce();
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      routingStatus: { enabled: true },
    }));

    fireEvent.change(textbox, { target: { value: "서울역" } });
    fireEvent.submit(screen.getByRole("form", {
      name: "Destination search",
    }));
    fireEvent.click(await screen.findByRole("button", {
      name: /서울역, 서울특별시/,
    }));
    await vi.waitFor(() => {
      expect(session.startRoute).toHaveBeenCalledWith(
        destination,
        "foot-walking",
      );
    });

    const active = {
      ...createInitialLiveDashboardState(),
      route: {
        status: "fresh" as const,
        fetchedAt: 1,
        value: {
          destinationName: "서울역",
          geometry: [
            { latitude: 37.5563, longitude: 126.922 },
            destination.coordinate,
          ],
          maneuvers: [],
          activeManeuverIndex: 0,
          remainingDistance: 4380,
          profile: "foot-walking" as const,
        },
      },
    };
    sessionOptions().onUpdate({ state: active, target: "all" });
    fireEvent.click(await screen.findByRole("button", {
      name: "End navigation",
    }));
    expect(session.endRoute).toHaveBeenCalledOnce();

    view.unmount();
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
