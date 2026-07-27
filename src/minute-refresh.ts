const MINUTE_MS = 60_000;
const MINUTE_POLL_MS = 5_000;
type Timer = ReturnType<typeof globalThis.setInterval>;

type MinuteSchedulerOptions = {
  readonly now?: () => number;
  readonly setIntervalImpl?: (
    callback: () => void,
    delay: number,
  ) => Timer;
  readonly clearIntervalImpl?: (timer: Timer) => void;
};

function minuteKey(time: number): number {
  return Math.floor(time / MINUTE_MS);
}

export function startMinuteRefresh(
  onMinute: (minute: number) => void,
  options: MinuteSchedulerOptions = {},
): () => void {
  const now = options.now ?? Date.now;
  const setIntervalImpl = options.setIntervalImpl ?? globalThis.setInterval;
  const clearIntervalImpl = options.clearIntervalImpl
    ?? globalThis.clearInterval;
  let stopped = false;
  let observedMinute = minuteKey(now());
  const timer = setIntervalImpl(() => {
    if (stopped) return;
    const currentMinute = minuteKey(now());
    if (currentMinute === observedMinute) return;
    observedMinute = currentMinute;
    onMinute(currentMinute);
  }, MINUTE_POLL_MS);

  return () => {
    if (stopped) return;
    stopped = true;
    clearIntervalImpl(timer);
  };
}
