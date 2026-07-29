// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "../live-cache";
import { translatePhone } from "../phone-i18n";
import { NavigationScreen } from "./NavigationScreen";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();

  async getLocalStorage(key: string): Promise<string> {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.values.set(key, value);
    return true;
  }
}

afterEach(cleanup);

describe("NavigationScreen", () => {
  it("removes the local key even when route cleanup is unavailable", async () => {
    const storage = new TestStorage();
    storage.values.set(
      "sandevistan:ors-key:v1",
      JSON.stringify("abcdefghijklmnop"),
    );
    const onKeyChange = vi.fn();
    render(
      <NavigationScreen
        storage={storage}
        routeControls={<div>Route controls</div>}
        t={(key) => translatePhone("en", key)}
        onKeyChange={onKeyChange}
        onDeleteRoute={vi.fn(async () => {
          throw new Error("session unavailable");
        })}
      />,
    );

    const deleteButton = await screen.findByRole("button", {
      name: "Delete key",
    });
    fireEvent.click(deleteButton);
    expect(await screen.findByText("Tap Delete again to confirm.")).toBeTruthy();
    fireEvent.click(deleteButton);

    await vi.waitFor(() => {
      expect(storage.values.get("sandevistan:ors-key:v1")).toBe("");
      expect(onKeyChange).toHaveBeenLastCalledWith(undefined);
    });
    expect(screen.queryByText("Could not save on this device.")).toBeNull();
  });
});
