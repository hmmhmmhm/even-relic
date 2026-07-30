export type ImageSendConcurrency = 1 | 2 | 3 | 4;

export function resolveImageSendConcurrency(
  search: string,
): ImageSendConcurrency {
  const value = new URLSearchParams(search).get("pipeline");
  if (value === "2") return 2;
  if (value === "3") return 3;
  if (value === "4") return 4;
  return 1;
}
