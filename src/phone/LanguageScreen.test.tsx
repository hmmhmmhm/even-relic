// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALE_OPTIONS } from "../i18n/locale-registry";
import { translatePhone } from "../phone-i18n";
import { LanguageScreen } from "./LanguageScreen";

afterEach(cleanup);

describe("LanguageScreen", () => {
  it("generates every language choice from the locale registry", () => {
    render(
      <LanguageScreen
        value="system"
        t={(key) => translatePhone("en", key)}
        onChange={vi.fn(async () => true)}
      />,
    );

    expect(screen.getAllByRole("radio").map((radio) => ({
      value: (radio as HTMLInputElement).value,
      label: radio.parentElement?.textContent,
    }))).toEqual([
      { value: "system", label: "System" },
      ...LOCALE_OPTIONS.map(({ value, label }) => ({ value, label })),
    ]);
  });

  it("commits a successful locale selection", async () => {
    const onChange = vi.fn(async () => true);
    render(
      <LanguageScreen
        value="system"
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "한국어" }));

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
