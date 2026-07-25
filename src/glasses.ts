import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { waitForImageClick } from "./image-trigger";
export const G2_TILES = [
  { id: 2, name: "relicTL", x: 0, y: 0, width: 288, height: 144 },
  { id: 3, name: "relicTR", x: 288, y: 0, width: 288, height: 144 },
  { id: 4, name: "relicBL", x: 0, y: 144, width: 288, height: 144 },
  { id: 5, name: "relicBR", x: 288, y: 144, width: 288, height: 144 },
] as const;
export const DIAGNOSTIC_TILES = [
  {
    id: 2,
    name: "frame",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    sourceX: 0,
    sourceY: 0,
  },
] as const;
type CanvasFactory = () => HTMLCanvasElement;
type ImageLoader = (url: string) => Promise<CanvasImageSource>;
type Tile = {
  readonly id: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly sourceX?: number;
  readonly sourceY?: number;
};
type Bridge = {
  createStartUpPageContainer: (page: CreateStartUpPageContainer) => Promise<unknown>;
  rebuildPageContainer: (page: RebuildPageContainer) => Promise<boolean>;
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>;
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};
type TransportDependencies = {
  waitForBridge: () => Promise<Bridge>;
  encode: typeof encodeCanvasTiles;
};
type OfficialBridge = Bridge & {
  textContainerUpgrade: (update: TextContainerUpgrade) => Promise<boolean>;
};
type OfficialDependencies = {
  waitForBridge: () => Promise<OfficialBridge>;
  loadBytes: (url: string) => Promise<Uint8Array>;
  waitForPageReady: (milliseconds: number) => Promise<void>;
};
type HardwareBmpDependencies = {
  waitForBridge: () => Promise<OfficialBridge>;
  waitForTrigger: typeof waitForImageClick;
};
async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}
export function quantizeForG2Pixels(source: Uint8ClampedArray) {
  const output = new Uint8ClampedArray(source.length);
  for (let index = 0; index < source.length; index += 4) {
    const red = source[index];
    const green = source[index + 1];
    const blue = source[index + 2];
    const isHudSignal = green >= 24 && green - Math.max(red, blue) >= 5;
    const level = isHudSignal
      ? Math.max(17, Math.min(255, Math.round(green / 17) * 17))
      : 0;
    output[index] = level;
    output[index + 1] = level;
    output[index + 2] = level;
    output[index + 3] = 255;
  }
  return output;
}

export async function drawHudReference(
  canvas: HTMLCanvasElement,
  sourceUrl: string,
  imageLoader: ImageLoader = loadImage,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");

  canvas.width = 576;
  canvas.height = 288;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#000";
  context.fillRect(0, 0, 576, 288);
  context.drawImage(await imageLoader(sourceUrl), 0, 0, 576, 288);
  const frame = context.getImageData(0, 0, 576, 288);
  frame.data.set(quantizeForG2Pixels(frame.data));
  context.putImageData(frame, 0, 0);
}

function createContainerObjects(tiles: readonly Tile[]) {
  const eventLayer = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: 1,
    containerName: "eventLayer",
    content: " ",
    isEventCapture: 1,
  });
  const imageObject = tiles.map((tile) => new ImageContainerProperty({
    xPosition: tile.x,
    yPosition: tile.y,
    width: tile.width,
    height: tile.height,
    containerID: tile.id,
    containerName: tile.name,
  }));
  return { eventLayer, imageObject };
}

export function createGlassesPage(tiles: readonly Tile[] = G2_TILES) {
  const { eventLayer, imageObject } = createContainerObjects(tiles);

  return new CreateStartUpPageContainer({
    containerTotalNum: tiles.length + 1,
    textObject: [eventLayer],
    imageObject,
  });
}

export function createOfficialDiagnosticPage() {
  const eventLayer = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: 1,
    containerName: "eventLayer",
    content: " ",
    isEventCapture: 1,
  });
  const status = new TextContainerProperty({
    xPosition: 0,
    yPosition: 220,
    width: 576,
    height: 40,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: 2,
    containerName: "status",
    content: "Loading...",
    isEventCapture: 0,
  });
  const image = new ImageContainerProperty({
    xPosition: 188,
    yPosition: 40,
    width: 200,
    height: 100,
    containerID: 3,
    containerName: "frame",
  });
  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [eventLayer, status],
    imageObject: [image],
  });
}

export async function encodeCanvasTiles(
  source: HTMLCanvasElement,
  canvasFactory: CanvasFactory = () => document.createElement("canvas"),
  tiles: readonly Tile[] = G2_TILES,
) {
  return Promise.all(tiles.map(async (tile) => {
    const canvas = canvasFactory();
    canvas.width = tile.width;
    canvas.height = tile.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("타일 Canvas를 만들 수 없습니다.");
    context.drawImage(
      source,
      tile.sourceX ?? tile.x,
      tile.sourceY ?? tile.y,
      tile.width,
      tile.height,
      0,
      0,
      tile.width,
      tile.height,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("PNG 인코딩에 실패했습니다.")),
        "image/png",
      );
    });
    return new Uint8Array(await blob.arrayBuffer());
  }));
}

export async function sendTilesSequentially(
  tiles: Uint8Array[],
  send: (bytes: Uint8Array, index: number) => Promise<void>,
) {
  for (let index = 0; index < tiles.length; index += 1) {
    await send(tiles[index], index);
  }
}

export function encode1BitBmp(
  width: number,
  height: number,
  pixels: Uint8Array,
) {
  const rowBytes = Math.ceil(width / 8);
  const stride = (rowBytes + 3) & ~3;
  const pixelOffset = 62;
  const bmp = new Uint8Array(pixelOffset + stride * height);
  const view = new DataView(bmp.buffer);
  bmp.set([0x42, 0x4d]);
  view.setUint32(2, bmp.byteLength, true);
  view.setUint32(10, pixelOffset, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 1, true);
  view.setUint32(34, stride * height, true);
  view.setUint32(46, 2, true);
  view.setUint32(50, 2, true);
  bmp.set([255, 255, 255, 0], 58);

  for (let y = 0; y < height; y += 1) {
    const destination = pixelOffset + (height - 1 - y) * stride;
    for (let x = 0; x < width; x += 1) {
      if (pixels[y * width + x]) {
        bmp[destination + Math.floor(x / 8)] |= 1 << (7 - (x % 8));
      }
    }
  }
  return bmp;
}

export async function transmitCanvas(
  source: HTMLCanvasElement,
  onProgress: (message: string) => void,
  dependencies: TransportDependencies = {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  },
  tiles: readonly Tile[] = G2_TILES,
) {
  onProgress("Even 앱 브리지 연결 대기 중");
  const bridge = await dependencies.waitForBridge();
  onProgress("안경 페이지 생성 중");

  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(createGlassesPage(tiles)),
  );
  if (created === StartUpPageCreateResult.invalid) {
    onProgress("기존 안경 페이지 재구성 중");
    const { eventLayer, imageObject } = createContainerObjects(tiles);
    const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: tiles.length + 1,
      textObject: [eventLayer],
      imageObject,
    }));
    if (!rebuilt) throw new Error("기존 안경 페이지 재구성 실패");
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`안경 페이지 생성 실패: ${created}`);
  }

  const encodedTiles = await dependencies.encode(source, undefined, tiles);
  await sendTilesSequentially(encodedTiles, async (bytes, index) => {
    const tile = tiles[index];
    const result = ImageRawDataUpdateResult.normalize(
      await bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: tile.id,
        containerName: tile.name,
        imageData: bytes,
      })),
    );
    if (!ImageRawDataUpdateResult.isSuccess(result)) {
      throw new Error(`${tile.name} 전송 실패: ${result}`);
    }
    onProgress(`안경 이미지 전송 중 ${index + 1}/${tiles.length}`);
  });

  onProgress("안경 전송 완료");
  return bridge.onEvenHubEvent((event) => {
    const systemEvent = event.sysEvent?.eventType ?? null;
    const textEvent = event.textEvent?.eventType ?? null;
    if (
      systemEvent === OsEventTypeList.DOUBLE_CLICK_EVENT
      || textEvent === OsEventTypeList.DOUBLE_CLICK_EVENT
    ) {
      void bridge.shutDownPageContainer(1);
    }
  });
}

export async function transmitOfficialSample(
  onProgress: (message: string) => void,
  dependencies: OfficialDependencies = {
    waitForBridge: waitForEvenAppBridge,
    loadBytes: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`공식 샘플 로드 실패: ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
    waitForPageReady: (milliseconds) => new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    }),
  },
) {
  onProgress("BRIDGE WAIT");
  const bridge = await dependencies.waitForBridge();
  onProgress("BRIDGE READY");
  const page = createOfficialDiagnosticPage();
  onProgress("PAGE CREATING");
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(page),
  );
  const resultName = StartUpPageCreateResult[created];
  onProgress(`PAGE RESULT: ${resultName}`);

  if (created === StartUpPageCreateResult.invalid) {
    onProgress("PAGE REBUILDING");
    const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: page.containerTotalNum,
      textObject: page.textObject,
      imageObject: page.imageObject,
    }));
    onProgress(`PAGE REBUILD RESULT: ${rebuilt}`);
    if (!rebuilt) throw new Error("PAGE REBUILD FAILED");
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`PAGE CREATE FAILED: ${resultName}`);
  }

  onProgress("PAGE READY 200x100 - SEND IN 3S");
  await dependencies.waitForPageReady(3000);
  const bytes = await dependencies.loadBytes("/evenhub-sample-8bit-200x100.png");
  const result = ImageRawDataUpdateResult.normalize(
    await bridge.updateImageRawData(new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: bytes,
    })),
  );
  if (!ImageRawDataUpdateResult.isSuccess(result)) {
    throw new Error(`공식 sample.png 전송 실패: ${result}`);
  }
  await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: "status",
    content: "Official sample rendered",
  }));
  onProgress("공식 sample.png 전송 완료");

  return bridge.onEvenHubEvent((event) => {
    const systemEvent = event.sysEvent?.eventType ?? null;
    const textEvent = event.textEvent?.eventType ?? null;
    if (
      systemEvent === OsEventTypeList.DOUBLE_CLICK_EVENT
      || textEvent === OsEventTypeList.DOUBLE_CLICK_EVENT
    ) {
      void bridge.shutDownPageContainer(1);
    }
  });
}

export async function transmitHardwareBmp(
  onProgress: (message: string) => void,
  dependencies: HardwareBmpDependencies = {
    waitForBridge: waitForEvenAppBridge,
    waitForTrigger: waitForImageClick,
  },
) {
  onProgress("실기기 검증 BMP 페이지 준비 중");
  const bridge = await dependencies.waitForBridge();
  const page = createOfficialDiagnosticPage();
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(page),
  );
  if (
    created !== StartUpPageCreateResult.success
    && created !== StartUpPageCreateResult.invalid
  ) {
    throw new Error(`BMP 시작 페이지 생성 실패: ${created}`);
  }
  const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: page.containerTotalNum,
    textObject: page.textObject,
    imageObject: page.imageObject,
  }));
  if (!rebuilt) throw new Error("BMP 이미지 페이지 재구성 실패");

  const announced = await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: "status",
    content: "TEXT READY - CLICK TO SEND",
  }));
  if (!announced) throw new Error("BMP 사전 텍스트 표시 실패");
  onProgress("안경 클릭 대기 중");
  await dependencies.waitForTrigger(bridge);
  const pixels = Uint8Array.from({ length: 200 * 100 }, (_, index) => {
    const x = index % 200;
    const y = Math.floor(index / 200);
    return (Math.floor(x / 12) + Math.floor(y / 12)) % 2 === 0 ? 1 : 0;
  });
  const bytes = encode1BitBmp(200, 100, pixels);
  const result = ImageRawDataUpdateResult.normalize(
    await bridge.updateImageRawData(new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: bytes,
    })),
  );
  if (!ImageRawDataUpdateResult.isSuccess(result)) {
    throw new Error(`1-bit BMP 전송 실패: ${result}`);
  }
  await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: "status",
    content: "1-bit BMP rendered",
  }));
  onProgress("1-bit BMP 전송 완료");
  return bridge.onEvenHubEvent(() => undefined);
}
