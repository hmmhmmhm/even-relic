// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteControls } from "./RouteControls";
import type { Destination } from "./routing";

const destination: Destination = {
  id: "venue.1",
  name: "서울역",
  label: "서울역, 서울특별시",
  coordinate: { latitude: 37.5547, longitude: 126.9707 },
};

afterEach(cleanup);

describe("RouteControls", () => {
  it("shows a clean disabled state without a destination input", () => {
    render(<RouteControls
      status={{ enabled: false }}
      onStart={vi.fn()}
      onEnd={vi.fn()}
    />);

    expect(screen.getByText("ORS 키 연결 후 길찾기 사용 가능")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("searches on submit and starts the selected profile", async () => {
    const search = vi.fn(async () => [destination]);
    const onStart = vi.fn(async () => undefined);
    render(<RouteControls
      status={{ enabled: true }}
      onStart={onStart}
      onEnd={vi.fn()}
      search={search}
    />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "서울역" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "cycling-regular" },
    });
    fireEvent.submit(screen.getByRole("form"));
    const result = await screen.findByRole("button", {
      name: /서울역, 서울특별시/,
    });
    expect(search).toHaveBeenCalledWith("서울역");

    fireEvent.click(result);
    await vi.waitFor(() => {
      expect(onStart).toHaveBeenCalledWith(
        destination,
        "cycling-regular",
      );
    });
  });

  it("requires two trimmed characters without making a request", async () => {
    const search = vi.fn();
    render(<RouteControls
      status={{ enabled: true }}
      onStart={vi.fn()}
      onEnd={vi.fn()}
      search={search}
    />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " 가 " },
    });
    fireEvent.submit(screen.getByRole("form"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "목적지를 두 글자 이상 입력하세요.",
    );
    expect(search).not.toHaveBeenCalled();
  });

  it("shows an end button instead of search controls for an active route", () => {
    const onEnd = vi.fn();
    render(<RouteControls
      status={{ enabled: true }}
      activeRoute={{
        destinationName: "서울역",
        geometry: [
          { latitude: 37.5563, longitude: 126.922 },
          destination.coordinate,
        ],
        maneuvers: [],
        activeManeuverIndex: 0,
        remainingDistance: 4380,
        profile: "foot-walking",
      }}
      onStart={vi.fn()}
      onEnd={onEnd}
    />);

    expect(screen.getByText(/서울역 안내 중/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "길찾기 종료" }));
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("offers retry and end actions for a stale restored route", async () => {
    const onResume = vi.fn();
    const onEnd = vi.fn();
    render(<RouteControls
      status={{ enabled: true }}
      routeStatus="stale"
      activeRoute={{
        destinationName: "서울역",
        geometry: [
          { latitude: 37.5563, longitude: 126.922 },
          destination.coordinate,
        ],
        maneuvers: [],
        activeManeuverIndex: 0,
        remainingDistance: 4380,
        profile: "foot-walking",
      }}
      onStart={vi.fn()}
      onResume={onResume}
      onEnd={onEnd}
    />);

    expect(screen.getByText("서울역 이전 경로")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "길찾기 다시 시작" }));
    expect(onResume).toHaveBeenCalledOnce();
    const end = screen.getByRole("button", { name: "길찾기 종료" });
    await vi.waitFor(() => expect(end.hasAttribute("disabled")).toBe(false));
    fireEvent.click(end);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("keeps controls available and reports a concise start error", async () => {
    const onStart = vi.fn(async () => {
      throw new Error("network detail that should not be shown");
    });
    render(<RouteControls
      status={{ enabled: true }}
      onStart={onStart}
      onEnd={vi.fn()}
      search={async () => [destination]}
    />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "서울역" },
    });
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.click(await screen.findByRole("button", { name: /서울역/ }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "경로를 시작하지 못했습니다. 다시 시도하세요.",
    );
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});
