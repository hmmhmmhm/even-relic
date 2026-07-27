export type DiagnosticCategory =
  | "APP"
  | "INPUT"
  | "LOCATION"
  | "STORAGE"
  | "LIVE"
  | "REFRESH"
  | "ENCODE"
  | "TILE"
  | "TIMER"
  | "ERROR";

export type DiagnosticEntry = {
  readonly sequence: number;
  readonly timestamp: string;
  readonly category: DiagnosticCategory;
  readonly message: string;
  readonly durationMs?: number;
};

type LoggerOptions = {
  readonly capacity?: number;
  readonly now?: () => Date;
};

function formatTimestamp(date: Date): string {
  const part = (value: number, width = 2) => (
    String(value).padStart(width, "0")
  );
  return `${part(date.getHours())}:${part(date.getMinutes())}:`
    + `${part(date.getSeconds())}.${part(date.getMilliseconds(), 3)}`;
}

function formatEntry(entry: DiagnosticEntry): string {
  return `[${entry.timestamp}] #${String(entry.sequence).padStart(4, "0")}`
    + ` [${entry.category}] ${entry.message}`
    + (entry.durationMs === undefined ? "" : ` · ${entry.durationMs}ms`);
}

export function createDiagnosticLogger(options: LoggerOptions = {}) {
  const capacity = Math.max(1, Math.floor(options.capacity ?? 300));
  const now = options.now ?? (() => new Date());
  let entries: DiagnosticEntry[] = [];
  let sequence = 0;
  let dropped = 0;
  let version = 0;

  const snapshot = () => ({
    version,
    dropped,
    capacity,
    entries: entries.map((entry) => ({ ...entry })),
  });

  return {
    append(
      category: DiagnosticCategory,
      message: string,
      durationMs?: number,
    ) {
      sequence += 1;
      entries.push({
        sequence,
        timestamp: formatTimestamp(now()),
        category,
        message,
        ...(durationMs === undefined
          ? {}
          : { durationMs: Math.max(0, Math.round(durationMs)) }),
      });
      if (entries.length > capacity) {
        entries = entries.slice(entries.length - capacity);
        dropped += 1;
      }
      version += 1;
    },
    clear() {
      entries = [];
      dropped = 0;
      version += 1;
    },
    snapshot,
    text: () => entries.map(formatEntry).join("\n"),
    version: () => version,
  };
}

export type DiagnosticLogger = ReturnType<typeof createDiagnosticLogger>;

export const diagnosticLogger = createDiagnosticLogger();
export const logDiagnostic = diagnosticLogger.append;

type HeartbeatOptions = {
  readonly intervalMs?: number;
  readonly now?: () => number;
};

export function startDiagnosticHeartbeat(
  logger: DiagnosticLogger = diagnosticLogger,
  options: HeartbeatOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? 5_000;
  const now = options.now ?? Date.now;
  let expected = now() + intervalMs;
  let stopped = false;
  logger.append("TIMER", `heartbeat started · interval ${intervalMs}ms`);
  const timer = globalThis.setInterval(() => {
    const current = now();
    const drift = Math.max(0, Math.round(current - expected));
    logger.append("TIMER", `heartbeat · drift ${drift}ms`);
    expected = current + intervalMs;
  }, intervalMs);
  return () => {
    if (stopped) return;
    stopped = true;
    globalThis.clearInterval(timer);
    logger.append("TIMER", "heartbeat stopped");
  };
}
