export type EvenStorage = {
  getLocalStorage(key: string): Promise<string>;
  setLocalStorage(key: string, value: string): Promise<boolean>;
};

export async function readCache<T>(
  storage: EvenStorage,
  key: string,
  validate: (value: unknown) => value is T,
): Promise<T | undefined> {
  try {
    const raw = await storage.getLocalStorage(`relic:${key}:v1`);
    if (!raw) {
      return undefined;
    }

    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function writeCache<T>(
  storage: EvenStorage,
  key: string,
  value: T,
): Promise<boolean> {
  try {
    return await storage.setLocalStorage(
      `relic:${key}:v1`,
      JSON.stringify(value),
    );
  } catch {
    return false;
  }
}

export async function clearCache(
  storage: EvenStorage,
  key: string,
): Promise<boolean> {
  try {
    return await storage.setLocalStorage(`relic:${key}:v1`, "");
  } catch {
    return false;
  }
}
