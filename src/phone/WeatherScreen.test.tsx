// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialLiveDashboardState } from "../live-state";
import { translatePhone } from "../phone-i18n";
import { WeatherScreen } from "./WeatherScreen";

afterEach(cleanup);

describe("WeatherScreen", () => {
  it("shows the nearest available place label and complete weather details", () => {
    const live = createInitialLiveDashboardState();
    render(
      <WeatherScreen
        live={{
          ...live,
          location: {
            status: "fresh",
            value: {
              coordinate: { latitude: 37.5563, longitude: 126.922 },
              source: "live",
            },
          },
          map: {
            status: "fresh",
            value: {
              roads: [],
              labels: [{
                kind: "place",
                name: "Hongdae",
                point: { latitude: 37.556, longitude: 126.923 },
              }],
              attribution: "© OSM CONTRIBUTORS",
            },
          },
          weather: {
            status: "fresh",
            fetchedAt: Date.now(),
            value: {
              temperature: 27,
              apparentTemperature: 29,
              humidity: 71,
              windSpeed: 12,
              precipitationProbability: 35,
              weatherCode: 1,
              condition: "대체로 맑음",
            },
          },
        }}
        locale="en"
        t={(key) => translatePhone("en", key)}
        onRefresh={vi.fn(() => Promise.resolve<"accepted">("accepted"))}
      />,
    );

    expect(screen.getByText("Hongdae")).toBeTruthy();
    expect(screen.getByText("27°")).toBeTruthy();
    expect(screen.getByText("29°")).toBeTruthy();
    expect(screen.getByText("71%")).toBeTruthy();
    expect(screen.getByText("35%")).toBeTruthy();
    expect(screen.getByText("12 km/h")).toBeTruthy();
  });

  it("explains that a dropped refresh is already in progress", async () => {
    render(
      <WeatherScreen
        live={createInitialLiveDashboardState()}
        locale="en"
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
        locale="en"
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
