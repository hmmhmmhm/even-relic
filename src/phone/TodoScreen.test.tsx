// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "../live-cache";
import { translatePhone } from "../phone-i18n";
import { TodoScreen } from "./TodoScreen";

afterEach(cleanup);

describe("TodoScreen", () => {
  it("uses the shared pixel icon set for completed tasks", () => {
    render(
      <TodoScreen
        items={[{ id: "todo-1", title: "Ship HUD", completed: true }]}
        t={(key) => translatePhone("en", key)}
        onChange={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Enabled" });
    expect(toggle.querySelector("svg")?.getAttribute("data-phone-icon"))
      .toBe("checkboxOn");
    expect(toggle.textContent).not.toContain("✓");
  });

  it("persists add, toggle, rename, and confirmed delete actions", async () => {
    const values = new Map<string, string>();
    const storage: EvenStorage = {
      async getLocalStorage(key) {
        return values.get(key) ?? "";
      },
      async setLocalStorage(key, value) {
        values.set(key, value);
        return true;
      },
    };
    const onChange = vi.fn();
    render(
      <TodoScreen
        items={[
          { id: "todo-1", title: "First", completed: false },
          { id: "todo-2", title: "Second", completed: false },
        ]}
        storage={storage}
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Disabled" })[0]);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls.at(-1)?.[0][0].completed).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Edit First" }));
    const rename = screen.getByDisplayValue("First");
    fireEvent.change(rename, { target: { value: "Renamed" } });
    fireEvent.blur(rename);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange.mock.calls.at(-1)?.[0][0].title).toBe("Renamed");

    fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), {
      target: { value: "Third" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(3));
    expect(onChange.mock.calls.at(-1)?.[0].at(-1).title).toBe("Third");

    fireEvent.click(screen.getByRole("button", { name: "Delete Second" }));
    expect(await screen.findByText("Tap Delete again to confirm.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Second" }));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
    expect(onChange.mock.calls.at(-1)?.[0].some(
      (item: { id: string }) => item.id === "todo-2",
    )).toBe(false);
  });

  it("keeps the current list and reports a storage rejection", async () => {
    const onChange = vi.fn();
    render(
      <TodoScreen
        items={[{ id: "todo-1", title: "First", completed: false }]}
        storage={{
          async getLocalStorage() {
            return "";
          },
          async setLocalStorage() {
            return false;
          },
        }}
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), {
      target: { value: "Second" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("Could not save on this device."))
      .toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Second")).toBeNull();
  });

  it("protects the final task after explicit delete confirmation", async () => {
    const onChange = vi.fn();
    render(
      <TodoScreen
        items={[{ id: "todo-1", title: "Only task", completed: false }]}
        storage={{
          async getLocalStorage() {
            return "";
          },
          async setLocalStorage() {
            return true;
          },
        }}
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    const deleteButton = screen.getByRole("button", {
      name: "Delete Only task",
    });
    fireEvent.click(deleteButton);
    expect(await screen.findByText("Tap Delete again to confirm.")).toBeTruthy();
    fireEvent.click(deleteButton);

    expect(await screen.findByText("Validation failed.")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Only task")).toBeTruthy();
  });
});
