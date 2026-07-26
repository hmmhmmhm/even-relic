const WIDTH = 576;
const HEIGHT = 288;

export function drawCalibrationPattern(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = "#ffffff";

  const rectangles: Array<[number, number, number, number]> = [
    [0, 0, WIDTH, 4],
    [0, HEIGHT - 4, WIDTH, 4],
    [0, 0, 4, HEIGHT],
    [WIDTH - 4, 0, 4, HEIGHT],
    [8, 8, WIDTH - 16, 2],
    [8, HEIGHT - 10, WIDTH - 16, 2],
    [8, 8, 2, HEIGHT - 16],
    [WIDTH - 10, 8, 2, HEIGHT - 16],
    [287, 0, 2, HEIGHT],
    [0, 143, WIDTH, 2],
  ];

  for (let x = 32; x < WIDTH; x += 32) {
    rectangles.push([x, 4, 2, 12], [x, HEIGHT - 16, 2, 12]);
  }
  for (let y = 32; y < HEIGHT; y += 32) {
    rectangles.push([4, y, 12, 2], [WIDTH - 16, y, 12, 2]);
  }
  for (const rectangle of rectangles) context.fillRect(...rectangle);

  context.font = "bold 20px monospace";
  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillText("TL", 24, 24);
  context.fillText("TR", 522, 24);
  context.fillText("BL", 24, 242);
  context.fillText("BR", 522, 242);
  context.fillText("576×288 MAX", 218, 112);
}
