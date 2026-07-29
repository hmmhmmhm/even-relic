// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "../live-cache";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "../live-state";
import { DEFAULT_PHONE_PREFERENCES } from "../phone-preferences";
import { DEFAULT_RSS_SOURCE } from "../rss-sources";
import { PhoneCompanion } from "./PhoneCompanion";

afterEach(cleanup);

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

function renderCompanion(
  preferences = DEFAULT_PHONE_PREFERENCES,
  live: LiveDashboardState = createInitialLiveDashboardState(),
  status = "Ready",
) {
  const storage = new TestStorage();
  return render(
    <PhoneCompanion
      canvas={<canvas data-testid="persistent-canvas" width="576" height="288" />}
      status={status}
      live={live}
      routingStatus={{ enabled: false }}
      preferences={preferences}
      storage={storage}
      onPreferencesChange={vi.fn()}
      onTodosChange={vi.fn()}
      onWeatherRefresh={vi.fn(async (): Promise<"accepted"> => "accepted")}
      routeControls={<div>Route controls</div>}
    />,
  );
}

describe("PhoneCompanion", () => {
  it("renders the approved eight full-card destinations and footer", () => {
    renderCompanion();

    expect(screen.queryByText("SANDEVISTAN / DASHBOARD")).toBeNull();
    expect(screen.getByRole("heading", {
      level: 2,
      name: "Dashboard",
    })).toBeTruthy();
    for (const name of [
      "Devices",
      "HUD layout",
      "News",
      "TODO",
      "Weather",
      "Navigation",
      "Language",
      "Developer",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(name) }))
        .toBeTruthy();
    }
    expect(screen.queryByText("Manage")).toBeNull();
    expect(screen.getByRole("link", { name: /GitHub/ }).getAttribute("href"))
      .toBe("https://github.com/hmmhmmhm/sandevistan");
    expect(screen.getByText("v0.1.0")).toBeTruthy();
  });

  it("opens a detail screen and returns without remounting the Canvas", () => {
    renderCompanion();
    const canvas = screen.getByTestId("persistent-canvas");

    fireEvent.click(screen.getByRole("button", { name: /Devices/ }));
    expect(screen.getByRole("heading", { name: "Devices" })).toBeTruthy();
    const parent = screen.getByText("Dashboard", {
      selector: ".phone-detail-header__parent",
    });
    const title = screen.getByText("Devices", {
      selector: ".phone-detail-header__title",
    });
    expect(getComputedStyle(parent).fontSize)
      .toBe(getComputedStyle(title).fontSize);
    expect(screen.getByTestId("persistent-canvas")).toBe(canvas);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    fireEvent.click(screen.getByRole("button", {
      name: "Dashboard / Devices",
    }));
    expect(screen.getByRole("heading", {
      level: 2,
      name: "Dashboard",
    })).toBeTruthy();
    expect(screen.getByTestId("persistent-canvas")).toBe(canvas);
  });

  it("opens every dashboard card directly with no intermediate menu", () => {
    renderCompanion();

    for (const name of [
      "Devices",
      "HUD layout",
      "News",
      "TODO",
      "Weather",
      "Navigation",
      "Language",
      "Developer",
    ]) {
      fireEvent.click(screen.getByRole("button", {
        name: new RegExp(`^${name}`),
      }));
      expect(screen.getByRole("heading", { name })).toBeTruthy();
      expect(screen.queryByText("Manage")).toBeNull();
      fireEvent.click(screen.getByRole("button", {
        name: `Dashboard / ${name}`,
      }));
    }
  });

  it("keeps diagnostics off Home and moves them into Developer", () => {
    renderCompanion();

    expect(screen.queryByText("WEBVIEW TRACE")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Developer/ }));
    expect(screen.getByText("WEBVIEW TRACE")).toBeTruthy();
  });

  it("shows routing mode and enabled RSS count only in Developer", () => {
    const storage = new TestStorage();
    render(
      <PhoneCompanion
        canvas={<canvas width="576" height="288" />}
        status="Ready"
        live={createInitialLiveDashboardState()}
        routingStatus={{ enabled: true }}
        preferences={{
          ...DEFAULT_PHONE_PREFERENCES,
          locale: "en",
        }}
        storage={storage}
        onPreferencesChange={vi.fn()}
        onTodosChange={vi.fn()}
        onWeatherRefresh={vi.fn(async (): Promise<"accepted"> => "accepted")}
        routeControls={<div>Route controls</div>}
        rssSources={[DEFAULT_RSS_SOURCE]}
      />,
    );

    expect(screen.queryByText("Routing mode")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Developer/ }));
    expect(screen.getByText("Routing mode")).toBeTruthy();
    expect(screen.getByText("RSS sources")).toBeTruthy();
    expect(screen.getByText("1 enabled")).toBeTruthy();
  });

  it("localizes the HUD preview landmark with the selected phone language", () => {
    renderCompanion({
      ...DEFAULT_PHONE_PREFERENCES,
      locale: "ko",
    });

    expect(screen.getByRole("region", {
      name: "실시간 HUD 미리보기",
    })).toBeTruthy();
  });

  it("renders cached weather and transport status in the selected language", () => {
    const initial = createInitialLiveDashboardState();
    renderCompanion(
      {
        ...DEFAULT_PHONE_PREFERENCES,
        locale: "en",
      },
      {
        ...initial,
        weather: {
          status: "fresh",
          value: {
            temperature: 26,
            apparentTemperature: 28,
            humidity: 62,
            windSpeed: 5,
            precipitationProbability: 10,
            weatherCode: 2,
            condition: "대체로 맑음",
          },
        },
      },
      "안경 전송 완료",
    );

    expect(screen.getByRole("button", { name: /Weather/ }).textContent)
      .toContain("Mostly clear");
    expect(screen.queryByText("대체로 맑음")).toBeNull();
    expect(screen.queryByText("안경 전송 완료")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Developer/ }));
    expect(screen.queryByText("안경 전송 완료")).toBeNull();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });
});
