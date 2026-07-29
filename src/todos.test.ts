import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  addTodo,
  DEFAULT_TODOS,
  deleteTodo,
  renameTodo,
  resolveTodos,
  toggleTodo,
  writeTodos,
} from "./todos";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];

  constructor(private readonly fails = false) {}

  async getLocalStorage(key: string): Promise<string> {
    if (this.fails) throw new Error("read failed");
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    if (this.fails) throw new Error("write failed");
    this.values.set(key, value);
    return true;
  }
}

const SAVED_TODOS = [
  { id: "one", title: "첫 번째 할 일", completed: true },
  { id: "two", title: "두 번째 할 일", completed: false },
] as const;

function setTodos(storage: TestStorage, value: unknown): void {
  storage.values.set("sandevistan:todos:v1", JSON.stringify(value));
}

describe("resolveTodos", () => {
  it("uses the three default tasks when no valid cache exists", async () => {
    const empty = new TestStorage();
    const corrupt = new TestStorage();
    corrupt.values.set("sandevistan:todos:v1", "{bad");

    await expect(resolveTodos(empty)).resolves.toEqual([
      { id: "station", title: "지하철역으로 이동", completed: false },
      { id: "umbrella", title: "우산 챙기기", completed: false },
      { id: "route", title: "경로 확인", completed: true },
    ]);
    await expect(resolveTodos(corrupt)).resolves.toEqual(DEFAULT_TODOS);
    await expect(resolveTodos(new TestStorage(true)))
      .resolves.toEqual(DEFAULT_TODOS);
  });

  it("restores a valid cache without sharing mutable records", async () => {
    const storage = new TestStorage();
    setTodos(storage, SAVED_TODOS);

    const result = await resolveTodos(storage);

    expect(result).toEqual(SAVED_TODOS);
    expect(result).not.toBe(SAVED_TODOS);
    expect(result[0]).not.toBe(SAVED_TODOS[0]);
  });

  it.each([
    ["empty title", [{ id: "one", title: "", completed: false }]],
    ["long title", [{
      id: "one",
      title: "가".repeat(41),
      completed: false,
    }]],
    ["control character", [{
      id: "one",
      title: "할\u0007일",
      completed: false,
    }]],
    ["duplicate id", [
      { id: "one", title: "첫 일", completed: false },
      { id: "one", title: "둘째 일", completed: true },
    ]],
    ["more than six", Array.from({ length: 7 }, (_, index) => ({
      id: `todo-${index}`,
      title: `할 일 ${index}`,
      completed: false,
    }))],
  ])("rejects a cache with %s", async (_label, value) => {
    const storage = new TestStorage();
    setTodos(storage, value);

    await expect(resolveTodos(storage)).resolves.toEqual(DEFAULT_TODOS);
  });
});

describe("todo changes", () => {
  it("adds and trims a task without mutating the input", () => {
    const result = addTodo(DEFAULT_TODOS, "  새 할 일  ", () => "new-id");

    expect(result).toHaveLength(DEFAULT_TODOS.length + 1);
    expect(result.at(-1)).toEqual({
      id: "new-id",
      title: "새 할 일",
      completed: false,
    });
    expect(DEFAULT_TODOS).toHaveLength(3);
  });

  it("renames by id and enforces the forty-code-point title limit", () => {
    const result = renameTodo(DEFAULT_TODOS, "station", `  ${"가".repeat(45)}  `);

    expect(result[0].title).toBe("가".repeat(40));
    expect(result[1]).toBe(DEFAULT_TODOS[1]);
  });

  it("rejects a seventh task and deletion of the final task", () => {
    const six = Array.from({ length: 6 }, (_, index) => ({
      id: `task-${index}`,
      title: `Task ${index}`,
      completed: false,
    }));

    expect(() => addTodo(six, "Seventh")).toThrowError("todo_limit");
    expect(() => deleteTodo([six[0]], six[0].id))
      .toThrowError("todo_last_item");
  });

  it("deletes a non-final task by id", () => {
    expect(deleteTodo(DEFAULT_TODOS, "umbrella").map((item) => item.id))
      .toEqual(["station", "route"]);
  });

  it("toggles a valid task and leaves the input records unchanged", () => {
    const result = toggleTodo(DEFAULT_TODOS, 1);

    expect(result[1].completed).toBe(true);
    expect(DEFAULT_TODOS[1].completed).toBe(false);
    expect(result[0]).toBe(DEFAULT_TODOS[0]);
  });

  it("returns the same list for an out-of-range index", () => {
    expect(toggleTodo(DEFAULT_TODOS, -1)).toBe(DEFAULT_TODOS);
    expect(toggleTodo(DEFAULT_TODOS, DEFAULT_TODOS.length))
      .toBe(DEFAULT_TODOS);
  });

  it("writes the fixed cache key and contains storage failures", async () => {
    const working = new TestStorage();
    const changed = toggleTodo(DEFAULT_TODOS, 0);

    await expect(writeTodos(working, changed)).resolves.toBe(true);
    expect(working.writes).toEqual([[
      "sandevistan:todos:v1",
      JSON.stringify(changed),
    ]]);
    await expect(writeTodos(new TestStorage(true), changed))
      .resolves.toBe(false);
  });
});
