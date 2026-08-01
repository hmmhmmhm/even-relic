export type AiRefreshScheduler = {
  request(): void;
  final(): Promise<boolean>;
  dispose(): void;
};

export function createAiRefreshScheduler(
  attempt: () => void | Promise<void>,
  delayMs = 300,
): AiRefreshScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let disposed = false;

  const run = async (): Promise<boolean> => {
    if (disposed || busy) return false;
    busy = true;
    try {
      await attempt();
      return true;
    } catch {
      return false;
    } finally {
      busy = false;
    }
  };

  return {
    request() {
      if (disposed || busy) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void run();
      }, delayMs);
    },
    async final() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      return run();
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
