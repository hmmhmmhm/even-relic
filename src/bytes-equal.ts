export function bytesEqual(
  left: Uint8Array | undefined,
  right: Uint8Array,
): boolean {
  if (!left || left.length !== right.length) return false;
  for (let index = 0; index < right.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
