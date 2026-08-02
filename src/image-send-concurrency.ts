export type ImageSendConcurrency = 1 | 2 | 3 | 4;

export function resolveImageSendConcurrency(
  search: string,
): ImageSendConcurrency {
  const value = new URLSearchParams(search).get("pipeline");
  if (value === "1") return 1;
  if (value === "2") return 2;
  if (value === "3") return 3;
  return value === "4" ? 4 : 1;
}
