import { useEffect, useRef, useState } from "react";
import {
  diagnosticLogger,
  type DiagnosticLogger,
} from "./diagnostic-log";
import { copyText } from "./copy-text";

type DiagnosticConsoleProps = {
  readonly logger?: DiagnosticLogger;
  readonly clipboard?: Pick<Clipboard, "writeText">;
  readonly labels?: DiagnosticConsoleLabels;
};

export type DiagnosticConsoleLabels = {
  readonly region: string;
  readonly title: string;
  readonly logDropped: string;
  readonly refreshDropped: string;
  readonly copy: string;
  readonly copied: string;
  readonly copyFailed: string;
  readonly clear: string;
};

const DEFAULT_LABELS: DiagnosticConsoleLabels = {
  region: "WebView operation console",
  title: "WEBVIEW TRACE",
  logDropped: "LOG DROPPED",
  refreshDropped: "REFRESH DROPPED",
  copy: "COPY",
  copied: "COPIED",
  copyFailed: "COPY FAILED",
  clear: "CLEAR",
};

export function DiagnosticConsole({
  logger = diagnosticLogger,
  clipboard,
  labels = DEFAULT_LABELS,
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
    <section className="diagnostic-console" aria-label={labels.region}>
      <header>
        <strong>{labels.title}</strong>
        <span>
          {snapshot.entries.length}/{snapshot.capacity}
          {" · "}{labels.logDropped} {snapshot.dropped}
          {" · "}{labels.refreshDropped} {snapshot.refreshDropped}
        </span>
        <div>
          <button type="button" onClick={() => void copy()}>
            {copyResult === "copied"
              ? labels.copied
              : copyResult === "failed"
                ? labels.copyFailed
                : labels.copy}
          </button>
          <button type="button" onClick={clear}>{labels.clear}</button>
        </div>
      </header>
      <pre ref={outputRef} data-testid="diagnostic-lines">
        {logger.text()}
      </pre>
    </section>
  );
}
