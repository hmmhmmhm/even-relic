// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "../live-cache";
import { translatePhone } from "../phone-i18n";
import { NewsScreen } from "./NewsScreen";

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

describe("NewsScreen", () => {
  it("renames sources and validates a custom feed before saving it", async () => {
    const storage = new TestStorage();
    storage.values.set("sandevistan:rss-sources:v1", JSON.stringify([
      {
        id: "sbs-latest",
        name: "SBS Latest",
        url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01",
        enabled: true,
        isDefault: true,
      },
    ]));
    const onSourcesChange = vi.fn();
    const fetchImpl = vi.fn(async () => new Response("<rss />", {
      status: 200,
      headers: { "content-type": "application/xml" },
    })) as typeof fetch;
    render(
      <NewsScreen
        storage={storage}
        t={(key) => translatePhone("en", key)}
        fetchImpl={fetchImpl}
        onSourcesChange={onSourcesChange}
      />,
    );
    fireEvent.click(await screen.findByRole("button", {
      name: "Edit SBS Latest",
    }));
    const sourceName = screen.getByRole("textbox", {
      name: "Source name SBS Latest",
    });
    fireEvent.change(sourceName, { target: { value: "Daily News" } });
    fireEvent.blur(sourceName);
    await vi.waitFor(() => expect(onSourcesChange).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Source name"), {
      target: { value: "Example" },
    });
    fireEvent.change(screen.getByLabelText("HTTPS RSS URL"), {
      target: { value: "https://feeds.example.com/rss.xml" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledWith(
      "/api/news?url=https%3A%2F%2Ffeeds.example.com%2Frss.xml",
      { headers: { accept: "application/xml,text/xml" } },
    ));
    await vi.waitFor(() => expect(onSourcesChange).toHaveBeenCalledTimes(2));
  });

  it("distinguishes a local-storage rejection from feed validation", async () => {
    const storage = new TestStorage();
    storage.writeResult = false;
    render(
      <NewsScreen
        storage={storage}
        t={(key) => translatePhone("en", key)}
        fetchImpl={vi.fn(async () => new Response("<rss />", {
          status: 200,
          headers: { "content-type": "application/xml" },
        })) as typeof fetch}
      />,
    );

    fireEvent.change(screen.getByLabelText("Source name"), {
      target: { value: "Example" },
    });
    fireEvent.change(screen.getByLabelText("HTTPS RSS URL"), {
      target: { value: "https://feeds.example.com/rss.xml" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Could not save on this device."))
      .toBeTruthy();
  });
});
