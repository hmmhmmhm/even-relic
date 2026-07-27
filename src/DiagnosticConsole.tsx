import { useEffect, useRef, useState } from "react";
import {
  diagnosticLogger,
  type DiagnosticLogger,
} from "./diagnostic-log";

type DiagnosticConsoleProps = {
  readonly logger?: DiagnosticLogger;
  readonly clipboard?: Pick<Clipboard, "writeText">;
};

export function DiagnosticConsole({
  logger = diagnosticLogger,
  clipboard,
}: DiagnosticConsoleProps) {
  const [snapshot, setSnapshot] = useState(logger.snapshot());
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let seen = logger.version();
    const timer = globalThis.setInterval(() => {
      const next = logger.version();
      if (next === seen) return;
      seen = next;
      setSnapshot(logger.snapshot());
    }, 250);
    return () => globalThis.clearInterval(timer);
  }, [logger]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [snapshot.version]);

  const copy = async () => {
    try {
      const target = clipboard ?? navigator.clipboard;
      if (!target) throw new Error("clipboard unavailable");
      await target.writeText(logger.text());
    } catch (error) {
      logger.append(
        "ERROR",
        `clipboard ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const clear = () => {
    logger.clear();
    setSnapshot(logger.snapshot());
  };

  return (
    <section className="diagnostic-console" aria-label="웹뷰 작업 콘솔">
      <header>
        <strong>WEBVIEW TRACE</strong>
        <span>
          {snapshot.entries.length}/{snapshot.capacity}
          {" · "}DROPPED {snapshot.dropped}
        </span>
        <div>
          <button type="button" onClick={() => void copy()}>COPY</button>
          <button type="button" onClick={clear}>CLEAR</button>
        </div>
      </header>
      <pre ref={outputRef} data-testid="diagnostic-lines">
        {logger.text()}
      </pre>
    </section>
  );
}
