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
  let active: Promise<boolean> | undefined;

  const run = (): Promise<boolean> => {
    if (disposed || busy) return Promise.resolve(false);
    busy = true;
    const operation = (async () => {
      try {
        await attempt();
        return true;
      } catch {
        return false;
      } finally {
        busy = false;
      }
    })();
    active = operation;
    void operation.finally(() => {
      if (active === operation) active = undefined;
    });
    return operation;
  };

  return {
    request() {
      if (disposed || busy) return;
      if (timer !== undefined) return;
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
      if (active) await active;
      return run();
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
