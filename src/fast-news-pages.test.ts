// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { paginateFastNewsSummary } from "./fast-news-pages";

function context() {
  return {
    font: "",
    measureText: (value: string) => ({
      width: [...value].length * 100,
    }),
  } as unknown as CanvasRenderingContext2D;
}

describe("fast news summary pages", () => {
  it("keeps every measured line and groups four lines per page", () => {
    expect(paginateFastNewsSummary(
      context(),
      "11111 22222 33333 44444 55555",
    )).toEqual([
      ["11111", "22222", "33333", "44444"],
      ["55555"],
    ]);
  });

  it("uses one explicit fallback page when the RSS summary is absent", () => {
    expect(paginateFastNewsSummary(context(), undefined)).toEqual([
      ["요약 없음"],
    ]);
  });

  it("localizes the fallback page without translating feed content", () => {
    expect(paginateFastNewsSummary(context(), undefined, "en")
      .flat()
      .join("")).toBe("Nosummary");
    expect(paginateFastNewsSummary(context(), "기사 원문", "en")
      .flat()
      .join("")).toBe("기사 원문");
  });
});
