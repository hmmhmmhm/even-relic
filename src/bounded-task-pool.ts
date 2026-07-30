export async function runBounded<T>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const capacity = Math.max(1, Math.floor(limit));

  await new Promise<void>((resolve, reject) => {
    let nextIndex = 0;
    let active = 0;
    let failed = false;
    let firstError: unknown;

    const finishIfReady = () => {
      if (active > 0) return;
      if (failed) reject(firstError);
      else if (nextIndex >= items.length) resolve();
    };

    const launch = () => {
      while (!failed && active < capacity && nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        active += 1;
        void Promise.resolve()
          .then(() => run(items[index], index))
          .then(
            () => {
              active -= 1;
              launch();
              finishIfReady();
            },
            (error: unknown) => {
              active -= 1;
              if (!failed) {
                failed = true;
                firstError = error;
              }
              finishIfReady();
            },
          );
      }
      finishIfReady();
    };

    launch();
  });
}
