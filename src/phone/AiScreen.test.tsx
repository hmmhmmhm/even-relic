// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiHudSnapshot } from "../ai-hud-state";
import type { EvenStorage } from "../live-cache";
import { translatePhone } from "../phone-i18n";
import { AiScreen } from "./AiScreen";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

afterEach(cleanup);

describe("AiScreen", () => {
  it("stores a validated BYOK key locally and only renders its masked form", async () => {
    const storage = new TestStorage();
    const onKeyChange = vi.fn();
    const key = "sk-test-1234567890abcdefghijklmnop";
    const view = render(
      <AiScreen
        storage={storage}
        snapshot={createAiHudSnapshot(false)}
        t={(name) => translatePhone("en", name)}
        onKeyChange={onKeyChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("OpenAI API key"), {
      target: { value: key },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onKeyChange).toHaveBeenCalledWith(key));
    expect(storage.values.get("sandevistan:openai-key:v1")).toContain(key);

    view.rerender(
      <AiScreen
        storage={storage}
        openAiKey={key}
        snapshot={createAiHudSnapshot(true)}
        t={(name) => translatePhone("en", name)}
      />,
    );
    expect(screen.queryByDisplayValue(key)).toBeNull();
    expect(screen.queryByText(key)).toBeNull();
    expect(screen.getByText("sk-t••••mnop")).toBeTruthy();
  });

  it("shows this device's week and month estimates plus three excerpts", () => {
    const history = ["one", "two", "three"].map((id, index) => ({
      id,
      endedAt: `2026-08-0${index + 1}T12:00:00.000Z`,
      user: `Question ${index + 1}`,
      assistant: `Answer ${index + 1}`,
    }));
    render(
      <AiScreen
        snapshot={createAiHudSnapshot(true, history, 0.0042, 0.018)}
        t={(name) => translatePhone("en", name)}
      />,
    );

    expect(screen.getByText("$0.0042")).toBeTruthy();
    expect(screen.getByText("$0.02")).toBeTruthy();
    expect(screen.getAllByText(/Question [1-3]/)).toHaveLength(3);
    expect(screen.getAllByText(/Answer [1-3]/)).toHaveLength(3);
  });
});
