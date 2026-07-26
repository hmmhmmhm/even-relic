const WIDTH = 576;
const HEIGHT = 288;
const COLOR = {
  background: "#000000",
  primary: "#ffffff",
  secondary: "#aaaaaa",
  dim: "#555555",
} as const;

type HudColor = typeof COLOR[keyof typeof COLOR];
type Point = readonly [number, number];

function drawPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = COLOR.dim;
  context.fillRect(x, y, width, 1);
  context.fillRect(x, y + height - 1, width, 1);
  context.fillRect(x, y, 1, height);
  context.fillRect(x + width - 1, y, 1, height);
}

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: HudColor = COLOR.primary,
  weight: "normal" | "bold" = "normal",
) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px "SFMono-Regular", Consolas, monospace`;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(value, x, y);
}

function drawPath(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
  width: number,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "square";
  context.lineJoin = "miter";
  context.stroke();
}

function fillPolygon(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawHeader(context: CanvasRenderingContext2D) {
  drawPanel(context, 8, 8, 132, 54);
  drawText(context, "14:37", 16, 10, 26, COLOR.primary, "bold");
  drawText(context, "HONGDAE", 16, 42, 12, COLOR.secondary, "bold");

  drawPanel(context, 148, 8, 276, 54);
  context.fillStyle = COLOR.secondary;
  context.fillRect(156, 28, 260, 2);
  for (let index = 0; index <= 10; index += 1) {
    const x = 160 + index * 25;
    const height = index % 5 === 0 ? 12 : 6;
    context.fillRect(x, 28 - height, 2, height);
  }
  drawText(context, "N", 206, 38, 11, COLOR.secondary);
  drawText(context, "NE 047°", 278, 37, 13, COLOR.primary, "bold");
  drawText(context, "E", 382, 38, 11, COLOR.secondary);

  drawPanel(context, 432, 8, 136, 54);
  drawText(context, "RELIC // LIVE", 440, 14, 11, COLOR.secondary, "bold");
  for (let index = 0; index < 5; index += 1) {
    context.fillStyle = index < 4 ? COLOR.primary : COLOR.dim;
    context.fillRect(442 + index * 15, 48 - index * 5, 9, 4 + index * 5);
  }
}

function drawMap(context: CanvasRenderingContext2D) {
  drawPanel(context, 8, 72, 184, 172);
  drawText(context, "MAP / 120m", 16, 78, 10, COLOR.secondary, "bold");

  const roads: readonly Point[][] = [
    [[18, 96], [58, 88], [98, 108], [180, 92]],
    [[18, 122], [68, 120], [116, 102], [182, 114]],
    [[18, 150], [62, 142], [98, 158], [182, 146]],
    [[18, 184], [58, 174], [106, 190], [182, 178]],
    [[18, 214], [74, 204], [124, 218], [182, 206]],
    [[38, 84], [42, 236]],
    [[82, 78], [74, 238]],
    [[130, 78], [138, 238]],
  ];
  for (const road of roads) drawPath(context, road, COLOR.dim, 1);

  drawPath(context, [
    [42, 226],
    [60, 196],
    [102, 184],
    [102, 150],
    [154, 150],
    [154, 110],
  ], COLOR.primary, 4);

  fillPolygon(context, [
    [58, 198],
    [70, 226],
    [58, 220],
    [46, 226],
  ], COLOR.primary);
  context.fillStyle = COLOR.primary;
  context.fillRect(149, 105, 12, 12);
  context.fillStyle = COLOR.background;
  context.fillRect(152, 108, 6, 6);

  drawPanel(context, 8, 252, 184, 28);
  drawText(context, "DEST 0.8km", 16, 259, 11, COLOR.primary, "bold");
  drawText(context, "N  ↑", 132, 259, 11, COLOR.secondary);
}

function drawNavigation(context: CanvasRenderingContext2D) {
  drawPanel(context, 204, 72, 188, 130);
  drawText(context, "NEXT 120m", 218, 82, 13, COLOR.secondary, "bold");

  context.fillStyle = COLOR.primary;
  context.fillRect(246, 132, 10, 42);
  context.fillRect(246, 122, 62, 10);
  fillPolygon(context, [
    [308, 108],
    [338, 127],
    [308, 146],
  ], COLOR.primary);
  drawText(context, "우회전", 286, 168, 18, COLOR.primary, "bold");

  drawPanel(context, 204, 214, 188, 66);
  drawText(context, "다음 교차로에서", 216, 226, 13, COLOR.secondary);
  drawText(context, "우회전 →", 216, 247, 19, COLOR.primary, "bold");
}

function drawSensors(context: CanvasRenderingContext2D) {
  drawPanel(context, 404, 72, 164, 62);
  drawText(context, "MIC", 414, 80, 10, COLOR.secondary, "bold");
  drawText(context, "-24 dBFS", 414, 96, 16, COLOR.primary, "bold");
  for (let index = 0; index < 6; index += 1) {
    const height = [8, 18, 28, 20, 14, 10][index];
    context.fillStyle = index < 4 ? COLOR.primary : COLOR.secondary;
    context.fillRect(490 + index * 11, 124 - height, 7, height);
  }
  context.fillStyle = COLOR.secondary;
  context.fillRect(414, 124, 142, 2);

  drawPanel(context, 404, 142, 164, 80);
  drawText(context, "ACC", 414, 150, 10, COLOR.secondary, "bold");
  drawText(context, "X +0.12", 414, 168, 13, COLOR.primary);
  drawText(context, "Y -0.03", 486, 168, 13, COLOR.primary);
  drawText(context, "Z +0.98", 414, 192, 13, COLOR.primary);
}

function drawQuest(context: CanvasRenderingContext2D) {
  drawPanel(context, 404, 230, 164, 50);
  drawText(context, "Q. 지하철역으로 이동", 412, 238, 10, COLOR.primary, "bold");
  drawText(context, "NEWS 02", 492, 258, 11, COLOR.secondary, "bold");
}

export function drawDenseCanvasHud(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  drawHeader(context);
  drawMap(context);
  drawNavigation(context);
  drawSensors(context);
  drawQuest(context);
}
