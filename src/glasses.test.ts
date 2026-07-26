// @vitest-environment jsdom
import {
  DeviceModel,
  OsEventTypeList,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { describe, expect, it, vi } from "vitest";

async function loadGlasses() {
  const module = await import("./glasses").catch(() => null);
  expect(module).not.toBeNull();
  return module;
}

describe("G2 raster transport", () => {
  it("covers the 576 by 288 display with four ordered tiles", async () => {
    const module = await loadGlasses();
    if (!module) return;

    expect(module.G2_TILES).toEqual([
      { id: 2, name: "relicTL", x: 0, y: 0, width: 288, height: 144 },
      { id: 3, name: "relicTR", x: 288, y: 0, width: 288, height: 144 },
      { id: 4, name: "relicBL", x: 0, y: 144, width: 288, height: 144 },
      { id: 5, name: "relicBR", x: 288, y: 144, width: 288, height: 144 },
    ]);
  });

  it("builds four image containers plus one blank event layer", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const page = module.createGlassesPage();
    expect(page.containerTotalNum).toBe(5);
    expect(page.textObject).toHaveLength(1);
    expect(page.textObject?.[0].content).toBe(" ");
    expect(page.textObject?.[0].isEventCapture).toBe(1);
    expect(page.imageObject?.map(({ containerID }) => containerID)).toEqual([2, 3, 4, 5]);
  });

  it("serializes explicit unique z-order with Text above every image", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const createLayeredGlassesPage = (
      module as unknown as {
        createLayeredGlassesPage?: () => {
          toJson: () => {
            textObject?: Array<{
              xPosition?: number;
              yPosition?: number;
              width?: number;
              height?: number;
              paddingLength?: number;
              zOrderIndex?: number;
            }>;
            imageObject?: Array<{ zOrderIndex?: number }>;
          };
        };
      }
    ).createLayeredGlassesPage;
    expect(createLayeredGlassesPage).toBeTypeOf("function");
    if (!createLayeredGlassesPage) return;

    const legacy = module.createGlassesPage().toJson();
    const layered = createLayeredGlassesPage().toJson();
    expect([
      ...legacy.imageObject!.map(
        ({ zOrderIndex }: { zOrderIndex?: number }) => zOrderIndex,
      ),
      legacy.textObject![0].zOrderIndex,
    ]).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(layered.imageObject?.map(({ zOrderIndex }) => zOrderIndex)).toEqual([
      1,
      2,
      3,
      4,
    ]);
    expect(layered.textObject?.[0]).toMatchObject({
      xPosition: 196,
      yPosition: 8,
      width: 372,
      height: 272,
      paddingLength: 8,
      zOrderIndex: 5,
    });
  });

  it("builds the official-size single-image diagnostic page", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const page = module.createGlassesPage(module.DIAGNOSTIC_TILES);
    expect(page.containerTotalNum).toBe(2);
    expect(page.textObject).toHaveLength(1);
    expect(page.imageObject).toHaveLength(1);
    expect(page.imageObject?.[0]).toMatchObject({
      containerID: 2,
      containerName: "frame",
      xPosition: 0,
      yPosition: 0,
      width: 200,
      height: 100,
    });
  });

  it("matches the official image template page exactly", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const page = module.createOfficialDiagnosticPage();
    expect(page.containerTotalNum).toBe(3);
    expect(page.textObject?.map(({ containerID }) => containerID)).toEqual([1, 2]);
    expect(page.imageObject?.[0]).toMatchObject({
      containerID: 3,
      containerName: "frame",
      xPosition: 188,
      yPosition: 40,
      width: 200,
      height: 100,
    });
  });

  it("encodes each display quadrant as an individual PNG", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const crops: number[][] = [];
    const canvasFactory = () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (...args: unknown[]) => crops.push(args.slice(1, 5) as number[]),
      }),
      toBlob: (done: BlobCallback) => done(new Blob(["tile"], { type: "image/png" })),
    }) as unknown as HTMLCanvasElement;

    const tiles = await module.encodeCanvasTiles(
      {} as HTMLCanvasElement,
      canvasFactory,
    );

    expect(tiles).toHaveLength(4);
    expect(crops).toEqual([
      [0, 0, 288, 144],
      [288, 0, 288, 144],
      [0, 144, 288, 144],
      [288, 144, 288, 144],
    ]);
    expect(tiles.every((tile) => tile.byteLength > 0)).toBe(true);
  });

  it("creates a full-size black Canvas for hidden display pixels", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const createBlackCanvas = (
      module as unknown as {
        createBlackCanvas?: (
          factory: () => HTMLCanvasElement,
        ) => HTMLCanvasElement;
      }
    ).createBlackCanvas;
    expect(createBlackCanvas).toBeTypeOf("function");
    if (!createBlackCanvas) return;

    let fillStyle = "";
    const fills: number[][] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        get fillStyle() {
          return fillStyle;
        },
        set fillStyle(value: string | CanvasGradient | CanvasPattern) {
          fillStyle = String(value);
        },
        fillRect: (...args: number[]) => fills.push(args),
      }),
    } as unknown as HTMLCanvasElement;

    expect(createBlackCanvas(() => canvas)).toBe(canvas);
    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(fillStyle).toBe("#000000");
    expect(fills).toEqual([[0, 0, 576, 288]]);
  });

  it("draws the selected reference into the exact G2 canvas", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const drawCalls: unknown[][] = [];
    let writtenPixels: Uint8ClampedArray | undefined;
    const pixels = new Uint8ClampedArray([2, 5, 2, 255]);
    const context = {
      fillRect: () => undefined,
      drawImage: (...args: unknown[]) => drawCalls.push(args),
      getImageData: () => ({ data: pixels }),
      putImageData: (imageData: { data: Uint8ClampedArray }) => {
        writtenPixels = imageData.data;
      },
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    const image = {} as CanvasImageSource;

    await module.drawHudReference(canvas, "/reference.png", async () => image);

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(drawCalls).toEqual([[image, 0, 0, 576, 288]]);
    expect(writtenPixels).toEqual(new Uint8ClampedArray([0, 0, 0, 255]));
  });

  it("removes near-black noise and emits only 16-level grayscale", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const pixels = new Uint8ClampedArray([
      2, 5, 2, 200,
      20, 20, 20, 255,
      10, 23, 10, 255,
      10, 25, 10, 255,
      50, 100, 40, 255,
    ]);

    expect(module.quantizeForG2Pixels(pixels)).toEqual(new Uint8ClampedArray([
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      17, 17, 17, 255,
      102, 102, 102, 255,
    ]));
  });

  it("sends BLE image updates strictly one at a time", async () => {
    const module = await loadGlasses();
    if (!module) return;

    let active = 0;
    let maximumActive = 0;
    const order: number[] = [];
    const tiles = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])];

    await module.sendTilesSequentially(tiles, async (_bytes, index) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      order.push(index);
      active -= 1;
    });

    expect(maximumActive).toBe(1);
    expect(order).toEqual([0, 1, 2]);
  });

  it("encodes a container-sized 1-bit BMP for the proven hardware path", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const width = 200;
    const height = 100;
    const pixels = new Uint8Array(width * height);
    pixels[0] = 1;
    const bmp = module.encode1BitBmp(width, height, pixels);
    const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);

    expect(Array.from(bmp.slice(0, 2))).toEqual([0x42, 0x4d]);
    expect(view.getUint32(10, true)).toBe(62);
    expect(view.getInt32(18, true)).toBe(width);
    expect(view.getInt32(22, true)).toBe(height);
    expect(view.getUint16(28, true)).toBe(1);
    expect(bmp.byteLength).toBe(2862);
    expect(bmp[62 + 99 * 28]).toBe(0x80);
  });

  it("creates the page before transmitting all four tiles", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const calls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      updateImageRawData: async (update: { containerID?: number }) => {
        calls.push(`image:${update.containerID}`);
        return "success";
      },
      rebuildPageContainer: async () => true,
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );

    expect(calls).toEqual(["create", "image:2", "image:3", "image:4", "image:5"]);
  });

  it("starts fast Canvas with four tiles and scrolls with the right two", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitFastCanvas = (
      module as unknown as {
        transmitFastCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitFastCanvas;
    expect(module.G2_RIGHT_TILES?.map(({ id }) => id)).toEqual([3, 5]);
    expect(transmitFastCanvas).toBeTypeOf("function");
    if (!transmitFastCanvas) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    const encodedTileIds: number[][] = [];
    const imageIds: number[] = [];
    const order: string[] = [];
    const batteries: unknown[] = [];
    const bridge = {
      getDeviceInfo: async () => {
        order.push("device");
        return {
          model: DeviceModel.G2,
          status: {
            batteryLevel: 82,
            isCharging: true,
          },
        };
      },
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    await transmitFastCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      async () => undefined,
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            _source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
          ) => {
            order.push("encode");
            encodedTileIds.push(tiles.map(({ id }) => id));
            return tiles.map(({ id }) => new Uint8Array([id]));
          },
        },
        onBattery: (battery: unknown) => batteries.push(battery),
      },
    );
    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(imageIds).toHaveLength(6));

    expect(encodedTileIds).toEqual([[2, 3, 4, 5], [3, 5]]);
    expect(imageIds).toEqual([2, 3, 4, 5, 3, 5]);
    expect(order.indexOf("device")).toBeLessThan(order.indexOf("encode"));
    expect(batteries).toEqual([{
      label: "G2",
      level: 82,
      charging: true,
    }]);
  });

  it("toggles fast Canvas pixels while keeping the app event layer alive", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitFastCanvas = (
      module as unknown as {
        transmitFastCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitFastCanvas;
    expect(transmitFastCanvas).toBeTypeOf("function");
    if (!transmitFastCanvas) return;

    const hudSource = { name: "hud" } as unknown as HTMLCanvasElement;
    const blackSource = { name: "black" } as unknown as HTMLCanvasElement;
    let listener: ((event: EvenHubEvent) => void) | undefined;
    let shutdownCalls = 0;
    let beforeRestoreCalls = 0;
    const navigationCalls: string[] = [];
    const encodes: Array<{ source: string; ids: number[] }> = [];
    const imageIds: number[] = [];
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => {
        shutdownCalls += 1;
        return true;
      },
    };
    const emit = (eventType: OsEventTypeList) => listener!({
      sysEvent: { eventType },
    } as EvenHubEvent);

    await transmitFastCanvas(
      hudSource,
      () => undefined,
      async (direction: string) => {
        navigationCalls.push(direction);
      },
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
          ) => {
            encodes.push({
              source: source === blackSource ? "black" : "hud",
              ids: tiles.map(({ id }) => id),
            });
            return tiles.map(({ id }) => new Uint8Array([id]));
          },
        },
        createHiddenSource: () => blackSource,
        beforeRestore: async () => {
          beforeRestoreCalls += 1;
        },
      },
    );

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(imageIds).toHaveLength(8));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await Promise.resolve();
    expect(imageIds).toHaveLength(8);
    expect(navigationCalls).toEqual([]);

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(imageIds).toHaveLength(12));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(imageIds).toHaveLength(14));

    expect(encodes).toEqual([
      { source: "hud", ids: [2, 3, 4, 5] },
      { source: "black", ids: [2, 3, 4, 5] },
      { source: "hud", ids: [2, 3, 4, 5] },
      { source: "hud", ids: [3, 5] },
    ]);
    expect(shutdownCalls).toBe(0);
    expect(navigationCalls).toEqual(["next"]);
    expect(beforeRestoreCalls).toBe(1);
  });

  it("retries failed hide and restore without corrupting visibility state", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitFastCanvas = (
      module as unknown as {
        transmitFastCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitFastCanvas;
    expect(transmitFastCanvas).toBeTypeOf("function");
    if (!transmitFastCanvas) return;

    const hudSource = { name: "hud" } as unknown as HTMLCanvasElement;
    const blackSource = { name: "black" } as unknown as HTMLCanvasElement;
    let listener: ((event: EvenHubEvent) => void) | undefined;
    let activeTransfer = "";
    let blackAttempts = 0;
    let fullHudAttempts = 0;
    const transfers: string[] = [];
    const progress: string[] = [];
    const navigationCalls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        if (
          update.containerID === 2
          && (activeTransfer === "black:1" || activeTransfer === "hud:2")
        ) return "sendFailed";
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };
    const emit = (eventType: OsEventTypeList) => listener!({
      sysEvent: { eventType },
    } as EvenHubEvent);

    await transmitFastCanvas(
      hudSource,
      (message: string) => progress.push(message),
      async (direction: string) => {
        navigationCalls.push(direction);
      },
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
          ) => {
            if (source === blackSource) {
              blackAttempts += 1;
              activeTransfer = `black:${blackAttempts}`;
            } else if (tiles.length === 4) {
              fullHudAttempts += 1;
              activeTransfer = `hud:${fullHudAttempts}`;
            } else {
              activeTransfer = "scroll";
            }
            transfers.push(activeTransfer);
            return tiles.map(({ id }) => new Uint8Array([id]));
          },
        },
        createHiddenSource: () => blackSource,
      },
    );

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(
      progress.filter((message) => message.includes("sendFailed")),
    ).toHaveLength(1));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(transfers).toHaveLength(3));

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(transfers).toHaveLength(4));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await Promise.resolve();
    expect(transfers).toHaveLength(4);

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(
      progress.filter((message) => message.includes("sendFailed")),
    ).toHaveLength(2));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await Promise.resolve();
    expect(transfers).toHaveLength(5);

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(transfers).toHaveLength(6));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(transfers).toHaveLength(7));

    expect(transfers).toEqual([
      "hud:1",
      "black:1",
      "scroll",
      "black:2",
      "hud:2",
      "hud:3",
      "scroll",
    ]);
    expect(navigationCalls).toEqual(["next", "next"]);
  });

  it("keeps fast Canvas transmission alive when battery lookup fails", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitFastCanvas = (
      module as unknown as {
        transmitFastCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitFastCanvas;
    expect(transmitFastCanvas).toBeTypeOf("function");
    if (!transmitFastCanvas) return;

    const imageIds: number[] = [];
    const batteries: unknown[] = [];
    const bridge = {
      getDeviceInfo: async () => {
        throw new Error("battery unavailable");
      },
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await transmitFastCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      async () => undefined,
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            _source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
          ) => tiles.map(({ id }) => new Uint8Array([id])),
        },
        onBattery: (battery: unknown) => batteries.push(battery),
      },
    );

    expect(batteries).toEqual([undefined]);
    expect(imageIds).toEqual([2, 3, 4, 5]);
  });

  it("sends the hybrid background once and pages with native Text only", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitHybridCanvas = (
      module as unknown as {
        transmitHybridCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitHybridCanvas;
    expect(transmitHybridCanvas).toBeTypeOf("function");
    if (!transmitHybridCanvas) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let startupPage: {
      textObject?: Array<{
        containerID?: number;
        content?: string;
        isEventCapture?: number;
        paddingLength?: number;
      }>;
    } | undefined;
    let createCount = 0;
    let rebuildCount = 0;
    const imageIds: number[] = [];
    const textContents: string[] = [];
    const bridge = {
      createStartUpPageContainer: async (page: typeof startupPage) => {
        startupPage = page;
        createCount += 1;
        return 0;
      },
      rebuildPageContainer: async () => {
        rebuildCount += 1;
        return true;
      },
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      textContainerUpgrade: async (update: { content?: string }) => {
        textContents.push(update.content!);
        return true;
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    const unsubscribe = await transmitHybridCanvas(
      {} as HTMLCanvasElement,
      "OVERVIEW 01 / 04",
      () => undefined,
      async (direction: string) => `${direction} PAGE`,
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );

    expect(startupPage?.textObject?.[0]).toMatchObject({
      containerID: 1,
      content: " ",
      isEventCapture: 1,
      paddingLength: 8,
    });
    expect(imageIds).toEqual([2, 3, 4, 5]);
    expect(textContents).toEqual(["OVERVIEW 01 / 04"]);

    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(textContents).toHaveLength(2));
    listener!({
      textEvent: { eventType: OsEventTypeList.SCROLL_TOP_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(textContents).toHaveLength(3));

    expect(imageIds).toEqual([2, 3, 4, 5]);
    expect(textContents).toEqual([
      "OVERVIEW 01 / 04",
      "next PAGE",
      "previous PAGE",
    ]);
    expect(createCount).toBe(1);
    expect(rebuildCount).toBe(0);
    unsubscribe();
  });

  it("keeps layered hybrid images static while scrolling native Text", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitLayeredHybridCanvas = (
      module as unknown as {
        transmitLayeredHybridCanvas?: (
          ...args: unknown[]
        ) => Promise<() => void>;
      }
    ).transmitLayeredHybridCanvas;
    expect(transmitLayeredHybridCanvas).toBeTypeOf("function");
    if (!transmitLayeredHybridCanvas) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let startupPage: {
      toJson: () => {
        textObject?: Array<{ zOrderIndex?: number }>;
        imageObject?: Array<{ zOrderIndex?: number }>;
      };
    } | undefined;
    const imageIds: number[] = [];
    const textContents: string[] = [];
    const bridge = {
      createStartUpPageContainer: async (page: typeof startupPage) => {
        startupPage = page;
        return 0;
      },
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      textContainerUpgrade: async (update: { content?: string }) => {
        textContents.push(update.content!);
        return true;
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    await transmitLayeredHybridCanvas(
      {} as HTMLCanvasElement,
      "OVERVIEW",
      () => undefined,
      async () => "NAVIGATION",
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );
    expect(startupPage!.toJson().imageObject?.map(
      ({ zOrderIndex }) => zOrderIndex,
    )).toEqual([1, 2, 3, 4]);
    expect(startupPage!.toJson().textObject?.[0].zOrderIndex).toBe(5);

    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(textContents).toHaveLength(2));
    expect(imageIds).toEqual([2, 3, 4, 5]);
    expect(textContents).toEqual(["OVERVIEW", "NAVIGATION"]);
  });

  it("rebuilds layered hybrid Text with the same console geometry", async () => {
    const module = await loadGlasses();
    if (!module) return;
    let rebuiltPage: {
      toJson: () => {
        textObject?: Array<{
          xPosition?: number;
          yPosition?: number;
          width?: number;
          height?: number;
          paddingLength?: number;
          zOrderIndex?: number;
        }>;
      };
    } | undefined;
    const bridge = {
      createStartUpPageContainer: async () => 1,
      rebuildPageContainer: async (page: typeof rebuiltPage) => {
        rebuiltPage = page;
        return true;
      },
      updateImageRawData: async () => "success",
      textContainerUpgrade: async () => true,
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitLayeredHybridCanvas(
      {} as HTMLCanvasElement,
      "OVERVIEW",
      () => undefined,
      async () => "NAVIGATION",
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );

    expect(rebuiltPage?.toJson().textObject?.[0]).toMatchObject({
      xPosition: 196,
      yPosition: 8,
      width: 372,
      height: 272,
      paddingLength: 8,
      zOrderIndex: 5,
    });
  });

  it("serializes rapid native Text page updates without resending images", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitHybridCanvas = (
      module as unknown as {
        transmitHybridCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitHybridCanvas;
    expect(transmitHybridCanvas).toBeTypeOf("function");
    if (!transmitHybridCanvas) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let blockText = false;
    let activeTextUpdates = 0;
    let maximumActiveTextUpdates = 0;
    let pageNumber = 0;
    const releases: Array<() => void> = [];
    const imageIds: number[] = [];
    const textContents: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      textContainerUpgrade: async (update: { content?: string }) => {
        textContents.push(update.content!);
        if (!blockText) return true;
        activeTextUpdates += 1;
        maximumActiveTextUpdates = Math.max(
          maximumActiveTextUpdates,
          activeTextUpdates,
        );
        await new Promise<void>((resolve) => {
          releases.push(() => {
            activeTextUpdates -= 1;
            resolve();
          });
        });
        return true;
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    await transmitHybridCanvas(
      {} as HTMLCanvasElement,
      "INITIAL",
      () => undefined,
      async (direction: string) => `${direction}:${++pageNumber}`,
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );
    blockText = true;
    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);

    for (let index = 0; index < 2; index += 1) {
      await vi.waitFor(() => expect(releases.length).toBeGreaterThan(0));
      releases.shift()!();
    }
    await vi.waitFor(() => expect(textContents).toHaveLength(3));

    expect(maximumActiveTextUpdates).toBe(1);
    expect(textContents).toEqual(["INITIAL", "next:1", "next:2"]);
    expect(imageIds).toEqual([2, 3, 4, 5]);
  });

  it("updates the same four containers for bottom and top scroll paging", async () => {
    const module = await loadGlasses();
    if (!module) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let createCount = 0;
    let rebuildCount = 0;
    const imageIds: number[] = [];
    const directions: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        createCount += 1;
        return 0;
      },
      rebuildPageContainer: async () => {
        rebuildCount += 1;
        return true;
      },
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    const unsubscribe = await module.transmitCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
      module.G2_TILES,
      async (direction: string) => {
        directions.push(direction);
      },
    );

    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(imageIds).toHaveLength(8));
    listener!({
      textEvent: { eventType: OsEventTypeList.SCROLL_TOP_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(imageIds).toHaveLength(12));

    expect(directions).toEqual(["next", "previous"]);
    expect(imageIds).toEqual([
      2, 3, 4, 5,
      2, 3, 4, 5,
      2, 3, 4, 5,
    ]);
    expect(createCount).toBe(1);
    expect(rebuildCount).toBe(0);
    unsubscribe();
  });

  it("serializes rapid scroll pages and every image update", async () => {
    const module = await loadGlasses();
    if (!module) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let blockUpdates = false;
    let activeUpdates = 0;
    let maximumActiveUpdates = 0;
    const releases: Array<() => void> = [];
    const imageIds: number[] = [];
    const directions: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        if (!blockUpdates) return "success";
        activeUpdates += 1;
        maximumActiveUpdates = Math.max(maximumActiveUpdates, activeUpdates);
        await new Promise<void>((resolve) => {
          releases.push(() => {
            activeUpdates -= 1;
            resolve();
          });
        });
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    await module.transmitCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
      module.G2_TILES,
      async (direction: string) => {
        directions.push(direction);
      },
    );
    blockUpdates = true;

    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);

    for (let index = 0; index < 8; index += 1) {
      await vi.waitFor(() => expect(releases.length).toBeGreaterThan(0));
      releases.shift()!();
    }
    await vi.waitFor(() => expect(imageIds).toHaveLength(12));

    expect(directions).toEqual(["next", "next"]);
    expect(maximumActiveUpdates).toBe(1);
    expect(imageIds).toEqual([
      2, 3, 4, 5,
      2, 3, 4, 5,
      2, 3, 4, 5,
    ]);
  });

  it("rebuilds an existing page when startup creation reports invalid", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const calls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 1;
      },
      rebuildPageContainer: async () => {
        calls.push("rebuild");
        return true;
      },
      updateImageRawData: async () => {
        calls.push("image");
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      {
        waitForBridge: async () => bridge,
        encode: async () => [new Uint8Array([1])],
      },
      module.DIAGNOSTIC_TILES,
    );

    expect(calls).toEqual(["create", "rebuild", "image"]);
  });

  it("sends the unmodified official sample bytes to container 3", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const calls: string[] = [];
    const sample = new Uint8Array([137, 80, 78, 71]);
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: {
        containerID?: number;
        imageData?: number[] | string | Uint8Array | ArrayBuffer;
      }) => {
        const firstByte = update.imageData instanceof Uint8Array
          ? update.imageData[0]
          : "unexpected";
        calls.push(`image:${update.containerID}:${firstByte}`);
        return "success";
      },
      textContainerUpgrade: async () => {
        calls.push("status");
        return true;
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitOfficialSample(
      () => undefined,
      {
        waitForBridge: async () => bridge,
        loadBytes: async () => sample,
        waitForPageReady: async () => {
          calls.push("ready");
        },
      } as Parameters<typeof module.transmitOfficialSample>[1],
    );

    expect(calls).toEqual(["create", "ready", "image:3:137", "status"]);
  });

  it("shows text, waits for a click, then sends the hardware-sized BMP", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const calls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      rebuildPageContainer: async () => {
        calls.push("rebuild");
        return true;
      },
      updateImageRawData: async (update: {
        containerID?: number;
        imageData?: number[] | string | Uint8Array | ArrayBuffer;
      }) => {
        const bytes = update.imageData as Uint8Array;
        calls.push(`image:${update.containerID}:${bytes[0]}:${bytes[1]}:${bytes.length}`);
        return "success";
      },
      textContainerUpgrade: async (update: { content?: string }) => {
        calls.push(update.content?.includes("CLICK TO SEND") ? "announce" : "status");
        return true;
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitHardwareBmp(
      () => undefined,
      {
        waitForBridge: async () => bridge,
        waitForTrigger: async () => {
          calls.push("click");
        },
      },
    );

    expect(calls).toEqual([
      "create",
      "rebuild",
      "announce",
      "click",
      "image:3:66:77:2862",
      "status",
    ]);
  });
});
