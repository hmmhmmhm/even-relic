// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    expect(toggle.querySelector("svg")).toBeTruthy();
    expect(toggle.textContent).not.toContain("✓");
  });
});
