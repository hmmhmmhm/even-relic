// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialLiveDashboardState } from "../live-state";
import { translatePhone } from "../phone-i18n";
import { WeatherScreen } from "./WeatherScreen";

afterEach(cleanup);

describe("WeatherScreen", () => {
  it("explains that a dropped refresh is already in progress", async () => {
    render(
      <WeatherScreen
        live={createInitialLiveDashboardState()}
        t={(key) => translatePhone("en", key)}
        onRefresh={vi.fn(() => Promise.resolve<"dropped">("dropped"))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("A refresh is already in progress."))
      .toBeTruthy();
  });

  it("recovers the button and reports a rejected refresh", async () => {
    render(
      <WeatherScreen
        live={createInitialLiveDashboardState()}
        t={(key) => translatePhone("en", key)}
        onRefresh={vi.fn(async () => {
          throw new Error("offline");
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("Could not refresh weather.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })
      .hasAttribute("disabled")).toBe(false);
  });
});
