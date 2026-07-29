// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiagnosticLogger } from "./diagnostic-log";
import { DiagnosticConsole } from "./DiagnosticConsole";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DiagnosticConsole", () => {
  it("batches updates at 250ms and renders one log text block", () => {
    vi.useFakeTimers();
    const logger = createDiagnosticLogger();
    render(<DiagnosticConsole logger={logger} />);
    logger.append("APP", "mounted");

    act(() => vi.advanceTimersByTime(249));
    expect(screen.queryByText(/mounted/)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("diagnostic-lines").textContent)
      .toContain("[APP] mounted");
    expect(document.querySelectorAll(".diagnostic-console pre")).toHaveLength(1);
  });

  it("copies the bounded snapshot and clears visible entries", async () => {
    vi.useFakeTimers();
    const logger = createDiagnosticLogger();
    const writeText = vi.fn(async () => undefined);
    render(
      <DiagnosticConsole
        logger={logger}
        clipboard={{ writeText }}
      />,
    );
    logger.append("LOCATION", "raw callback #1");
    act(() => vi.advanceTimersByTime(250));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "COPY" }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("[LOCATION] raw callback #1"),
    );
    expect(screen.getByRole("button", { name: "COPIED" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "CLEAR" }));
    expect(screen.getByTestId("diagnostic-lines").textContent).toBe("");
  });

  it("shows COPY FAILED when both copy paths reject", async () => {
    const logger = createDiagnosticLogger();
    render(
      <DiagnosticConsole
        logger={logger}
        clipboard={{
          writeText: vi.fn(async () => {
            throw new Error("not allowed");
          }),
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "COPY" }));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", {
      name: "COPY FAILED",
    })).toBeTruthy();
  });

  it("uses localized control labels and exposes refresh-drop count", () => {
    vi.useFakeTimers();
    const logger = createDiagnosticLogger();
    render(
      <DiagnosticConsole
        logger={logger}
        labels={{
          region: "웹뷰 작업 기록",
          title: "웹뷰 기록",
          logDropped: "기록 삭제",
          refreshDropped: "갱신 버림",
          copy: "복사",
          copied: "복사됨",
          copyFailed: "복사 실패",
          clear: "비우기",
        }}
      />,
    );

    logger.append("REFRESH", "external left dropped · busy");
    act(() => vi.advanceTimersByTime(250));

    expect(screen.getByRole("region", { name: "웹뷰 작업 기록" }))
      .toBeTruthy();
    expect(screen.getByRole("button", { name: "복사" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "비우기" })).toBeTruthy();
    expect(screen.getByText(/갱신 버림 1/)).toBeTruthy();
  });
});
