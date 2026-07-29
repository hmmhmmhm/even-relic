import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  DEFAULT_RSS_SOURCE,
  addRssSource,
  deleteRssSource,
  resolveRssSources,
  validateRssSourceUrl,
  writeRssSources,
} from "./rss-sources";

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

describe("RSS source preferences", () => {
  it("seeds one enabled non-deletable SBS source", async () => {
    await expect(resolveRssSources(new TestStorage())).resolves.toEqual([
      DEFAULT_RSS_SOURCE,
    ]);
    expect(DEFAULT_RSS_SOURCE).toMatchObject({
      id: "sbs-latest",
      name: "SBS Latest",
      enabled: true,
      isDefault: true,
    });
  });

  it("accepts only public-looking HTTPS URLs on the client", () => {
    expect(validateRssSourceUrl("https://example.com/feed.xml")).toEqual({
      ok: true,
      value: "https://example.com/feed.xml",
    });
    expect(validateRssSourceUrl("http://example.com/feed.xml").ok).toBe(false);
    expect(validateRssSourceUrl("https://localhost/feed.xml").ok).toBe(false);
    expect(validateRssSourceUrl("https://127.0.0.1/feed.xml").ok).toBe(false);
  });

  it("adds up to six sources and never deletes the default", () => {
    let sources = [DEFAULT_RSS_SOURCE];
    for (let index = 0; index < 5; index += 1) {
      sources = [...addRssSource(
        sources,
        `Feed ${index}`,
        `https://example${index}.com/feed.xml`,
      )];
    }
    expect(sources).toHaveLength(6);
    expect(() => addRssSource(
      sources,
      "Overflow",
      "https://overflow.example/feed.xml",
    )).toThrowError("rss_source_limit");
    expect(deleteRssSource(sources, "sbs-latest")).toEqual(sources);
  });

  it("persists normalized sources", async () => {
    const storage = new TestStorage();
    const sources = addRssSource(
      [DEFAULT_RSS_SOURCE],
      "Example",
      "https://example.com/feed.xml",
    );
    await expect(writeRssSources(storage, sources)).resolves.toBe(true);
    await expect(resolveRssSources(storage)).resolves.toEqual(sources);
  });
});
