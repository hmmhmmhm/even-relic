// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translatePhone } from "../phone-i18n";
import { LanguageScreen } from "./LanguageScreen";

afterEach(cleanup);

describe("LanguageScreen", () => {
  it("commits a successful locale selection", async () => {
    const onChange = vi.fn(async () => true);
    render(
      <LanguageScreen
        value="system"
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Korean" }));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("ko"));
    expect(screen.queryByText("Could not save on this device.")).toBeNull();
  });

  it("reports a local-storage failure instead of silently reverting", async () => {
    const onChange = vi.fn(async () => false);
    render(
      <LanguageScreen
        value="system"
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "English" }));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("en"));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not save on this device.",
    );
  });
});
