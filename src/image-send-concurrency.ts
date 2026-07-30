export type ImageSendConcurrency = 1 | 2 | 3;

export function resolveImageSendConcurrency(
  search: string,
): ImageSendConcurrency {
  const value = new URLSearchParams(search).get("pipeline");
  return value === "2" ? 2 : value === "3" ? 3 : 1;
}
