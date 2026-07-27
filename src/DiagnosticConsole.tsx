import { useEffect, useRef, useState } from "react";
import {
  diagnosticLogger,
  type DiagnosticLogger,
} from "./diagnostic-log";
import { copyText } from "./copy-text";

type DiagnosticConsoleProps = {
  readonly logger?: DiagnosticLogger;
  readonly clipboard?: Pick<Clipboard, "writeText">;
};

export function DiagnosticConsole({
  logger = diagnosticLogger,
  clipboard,
}: DiagnosticConsoleProps) {
  const [snapshot, setSnapshot] = useState(logger.snapshot());
  const [copyResult, setCopyResult] = useState<
    "idle" | "copied" | "failed"
  >("idle");
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
    const target = clipboard ?? (
      typeof navigator === "undefined" ? undefined : navigator.clipboard
    );
    const copied = await copyText(logger.text(), {
      clipboard: target,
    });
    setCopyResult(copied ? "copied" : "failed");
    if (!copied) {
      logger.append("ERROR", "clipboard copy failed");
    }
  };

  const clear = () => {
    logger.clear();
    setCopyResult("idle");
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
          <button type="button" onClick={() => void copy()}>
            {copyResult === "copied"
              ? "COPIED"
              : copyResult === "failed"
                ? "COPY FAILED"
                : "COPY"}
          </button>
          <button type="button" onClick={clear}>CLEAR</button>
        </div>
      </header>
      <pre ref={outputRef} data-testid="diagnostic-lines">
        {logger.text()}
      </pre>
    </section>
  );
}
