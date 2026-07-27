const MINUTE_MS = 60_000;
type Timer = ReturnType<typeof globalThis.setTimeout>;

type MinuteSchedulerOptions = {
  readonly now?: () => number;
  readonly setTimeoutImpl?: (callback: () => void, delay: number) => Timer;
  readonly clearTimeoutImpl?: (timer: Timer) => void;
};

export function millisecondsUntilNextMinute(now: number): number {
  const remainder = ((now % MINUTE_MS) + MINUTE_MS) % MINUTE_MS;
  return remainder === 0 ? MINUTE_MS : MINUTE_MS - remainder;
}

export function startMinuteRefresh(
  onMinute: () => void,
  options: MinuteSchedulerOptions = {},
): () => void {
  const now = options.now ?? Date.now;
  const setTimeoutImpl = options.setTimeoutImpl ?? globalThis.setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? globalThis.clearTimeout;
  let stopped = false;
  let timer: Timer | undefined;

  const schedule = () => {
    timer = setTimeoutImpl(() => {
      if (stopped) return;
      onMinute();
      schedule();
    }, millisecondsUntilNextMinute(now()));
  };
  schedule();

  return () => {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) clearTimeoutImpl(timer);
  };
}
