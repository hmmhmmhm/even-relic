// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { copyText } from "./copy-text";

function copyDocument(execCommand: (command: string) => boolean) {
  return {
    body: document.body,
    createElement: document.createElement.bind(document),
    execCommand,
  };
}

describe("copyText", () => {
  it("falls back to a selected textarea without Clipboard API", async () => {
    const execCommand = vi.fn(() => true);

    const copied = await copyText("trace", {
      document: copyDocument(execCommand),
    });

    expect(copied).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back after Clipboard API rejects", async () => {
    const clipboard = {
      writeText: vi.fn(async () => {
        throw new Error("not allowed");
      }),
    };
    const execCommand = vi.fn(() => true);

    await expect(copyText("trace", {
      clipboard,
      document: copyDocument(execCommand),
    })).resolves.toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledWith("trace");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports failure and removes its textarea when both paths fail", async () => {
    const execCommand = vi.fn(() => false);

    await expect(copyText("trace", {
      document: copyDocument(execCommand),
    })).resolves.toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});
