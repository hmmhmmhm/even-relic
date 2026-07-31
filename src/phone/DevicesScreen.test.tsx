// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { translatePhone } from "../phone-i18n";
import { DevicesScreen } from "./DevicesScreen";

afterEach(cleanup);

describe("DevicesScreen", () => {
  it("shows the available G2 battery and honest R1 unavailability", () => {
    render(
      <DevicesScreen
        battery={{
          label: "G2",
          level: 43,
          charging: true,
        }}
        status="Ready"
        t={(key) => translatePhone("en", key)}
      />,
    );

    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("43% · Charging")).toBeTruthy();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("0.0.13")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
  });
});
