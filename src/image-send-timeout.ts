import { logDiagnostic } from "./diagnostic-log";

const TILE_SEND_TIMEOUT_MS = 12_000;

export function waitForTileSend<T>(
  promise: Promise<T>,
  tileName: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      logDiagnostic(
        "ERROR",
        `${tileName} timeout · ${TILE_SEND_TIMEOUT_MS}ms`,
      );
      reject(new Error(
        `${tileName} 전송 제한 시간 초과: ${TILE_SEND_TIMEOUT_MS}ms`,
      ));
    }, TILE_SEND_TIMEOUT_MS);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
