import { logDiagnostic } from "./diagnostic-log";

export type EvenStorage = {
  getLocalStorage(key: string): Promise<string>;
  setLocalStorage(key: string, value: string): Promise<boolean>;
};

const diagnosticNow = () => (
  typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now()
);

const diagnosticDuration = (startedAt: number) => (
  diagnosticNow() - startedAt
);

const diagnosticErrorKind = (error: unknown) => (
  error instanceof Error ? error.name : typeof error
);

export async function readCache<T>(
  storage: EvenStorage,
  key: string,
  validate: (value: unknown) => value is T,
): Promise<T | undefined> {
  const startedAt = diagnosticNow();
  logDiagnostic("STORAGE", `read ${key} start`);
  let raw: string;
  try {
    raw = await storage.getLocalStorage(`relic:${key}:v1`);
  } catch (error) {
    logDiagnostic(
      "ERROR",
      `storage read ${key} failed · ${diagnosticErrorKind(error)}`,
      diagnosticDuration(startedAt),
    );
    return undefined;
  }
  if (!raw) {
    logDiagnostic(
      "STORAGE",
      `read ${key} miss`,
      diagnosticDuration(startedAt),
    );
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(raw);
    const valid = validate(value);
    logDiagnostic(
      "STORAGE",
      `read ${key} ${valid ? "hit" : "invalid"}`,
      diagnosticDuration(startedAt),
    );
    return valid ? value : undefined;
  } catch (error) {
    logDiagnostic(
      "STORAGE",
      `read ${key} invalid · ${diagnosticErrorKind(error)}`,
      diagnosticDuration(startedAt),
    );
    return undefined;
  }
}

export async function writeCache<T>(
  storage: EvenStorage,
  key: string,
  value: T,
): Promise<boolean> {
  const startedAt = diagnosticNow();
  logDiagnostic("STORAGE", `write ${key} start`);
  try {
    const result = await storage.setLocalStorage(
      `relic:${key}:v1`,
      JSON.stringify(value),
    );
    logDiagnostic(
      "STORAGE",
      `write ${key} ${result ? "success" : "rejected"}`,
      diagnosticDuration(startedAt),
    );
    return result;
  } catch (error) {
    logDiagnostic(
      "ERROR",
      `storage write ${key} failed · ${diagnosticErrorKind(error)}`,
      diagnosticDuration(startedAt),
    );
    return false;
  }
}

export async function clearCache(
  storage: EvenStorage,
  key: string,
): Promise<boolean> {
  const startedAt = diagnosticNow();
  logDiagnostic("STORAGE", `clear ${key} start`);
  try {
    const result = await storage.setLocalStorage(`relic:${key}:v1`, "");
    logDiagnostic(
      "STORAGE",
      `clear ${key} ${result ? "success" : "rejected"}`,
      diagnosticDuration(startedAt),
    );
    return result;
  } catch (error) {
    logDiagnostic(
      "ERROR",
      `storage clear ${key} failed · ${diagnosticErrorKind(error)}`,
      diagnosticDuration(startedAt),
    );
    return false;
  }
}
