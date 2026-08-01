export function fastRefreshDropReason(options: {
  readonly available: boolean;
  readonly disposed: boolean;
  readonly hidden: boolean;
  readonly nativeText: boolean;
  readonly busy: boolean;
}): string | undefined {
  if (!options.available) return "unavailable";
  if (options.disposed) return "disposed";
  if (options.hidden) return "hidden";
  if (options.nativeText) return "native-text";
  if (options.busy) return "busy";
  return undefined;
}
