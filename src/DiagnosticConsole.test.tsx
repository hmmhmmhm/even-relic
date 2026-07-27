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
});
