// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "../live-cache";
import { translatePhone } from "../phone-i18n";
import { NavigationScreen } from "./NavigationScreen";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  writeResult = true;

  async getLocalStorage(key: string): Promise<string> {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    if (this.writeResult) this.values.set(key, value);
    return this.writeResult;
  }
}

afterEach(cleanup);

describe("NavigationScreen", () => {
  it("validates and stores a device-local key before enabling controls", async () => {
    const storage = new TestStorage();
    const onKeyChange = vi.fn();
    const fetchImpl = vi.fn(async () => new Response("{}", {
      status: 200,
    })) as typeof fetch;
    render(
      <NavigationScreen
        storage={storage}
        routeControls={<div>Route controls</div>}
        t={(key) => translatePhone("en", key)}
        fetchImpl={fetchImpl}
        onKeyChange={onKeyChange}
      />,
    );

    fireEvent.change(await screen.findByLabelText("OpenRouteService key"), {
      target: { value: "abcdefghijklmnop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate key" }));

    expect(await screen.findByText("abcd••••mnop")).toBeTruthy();
    expect(screen.getByText("Route controls")).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledWith("/api/routing-key-test", {
      method: "POST",
      headers: {
        accept: "application/json",
        "x-sandevistan-ors-key": "abcdefghijklmnop",
      },
    });
    expect(storage.values.get("sandevistan:ors-key:v1"))
      .toBe(JSON.stringify("abcdefghijklmnop"));
    expect(onKeyChange).toHaveBeenLastCalledWith("abcdefghijklmnop");
  });

  it("removes the local key even when route cleanup is unavailable", async () => {
    const storage = new TestStorage();
    storage.values.set(
      "sandevistan:ors-key:v1",
      JSON.stringify("abcdefghijklmnop"),
    );
    storage.values.set(
      "sandevistan:active-route:v1",
      JSON.stringify({ route: "cached" }),
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
      expect(storage.values.get("sandevistan:active-route:v1")).toBe("");
      expect(onKeyChange).toHaveBeenLastCalledWith(undefined);
    });
    expect(screen.queryByText("Could not save on this device.")).toBeNull();
  });

  it("reports a storage failure separately after a valid key response", async () => {
    const storage = new TestStorage();
    storage.writeResult = false;
    render(
      <NavigationScreen
        storage={storage}
        routeControls={<div>Route controls</div>}
        t={(key) => translatePhone("en", key)}
        fetchImpl={vi.fn(async () => new Response("{}", {
          status: 200,
        })) as typeof fetch}
      />,
    );

    const input = await screen.findByLabelText("OpenRouteService key");
    fireEvent.change(input, {
      target: { value: "abcdefghijklmnop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate key" }));

    expect(await screen.findByText("Could not save on this device."))
      .toBeTruthy();
    expect(storage.values.has("sandevistan:ors-key:v1")).toBe(false);
  });
});
