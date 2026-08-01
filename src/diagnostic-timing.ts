export const diagnosticNow = () => (
  typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now()
);

export const diagnosticDuration = (startedAt: number) => (
  diagnosticNow() - startedAt
);

export const diagnosticError = (error: unknown) => (
  error instanceof Error ? error.message : String(error)
);
