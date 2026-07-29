import { readCache, writeCache, type EvenStorage } from "./live-cache";
import {
  DEFAULT_TODOS as LIVE_DEFAULT_TODOS,
  type TodoItem,
} from "./live-state";

const TODO_LIMIT = 6;
const TODO_TITLE_MAX_CODE_POINTS = 40;
const TODO_ID_MAX_CODE_POINTS = 64;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export const DEFAULT_TODOS = LIVE_DEFAULT_TODOS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNormalizedText(
  value: unknown,
  maxCodePoints: number,
): value is string {
  return typeof value === "string"
    && value.length > 0
    && value === value.trim()
    && [...value].length <= maxCodePoints
    && !CONTROL_CHARACTERS.test(value);
}

function isTodoList(value: unknown): value is readonly TodoItem[] {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.length > TODO_LIMIT
  ) {
    return false;
  }

  const ids = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item)
      || !isNormalizedText(item.id, TODO_ID_MAX_CODE_POINTS)
      || !isNormalizedText(item.title, TODO_TITLE_MAX_CODE_POINTS)
      || typeof item.completed !== "boolean"
      || ids.has(item.id)
    ) {
      return false;
    }
    ids.add(item.id);
  }
  return true;
}

function cloneTodos(items: readonly TodoItem[]): readonly TodoItem[] {
  return items.map((item) => ({ ...item }));
}

function normalizeTodoTitle(value: string): string {
  return [...value.trim().replace(/\s+/g, " ")]
    .slice(0, TODO_TITLE_MAX_CODE_POINTS)
    .join("");
}

function assertTodoTitle(value: string): string {
  const normalized = normalizeTodoTitle(value);
  if (!normalized || CONTROL_CHARACTERS.test(normalized)) {
    throw new Error("todo_title");
  }
  return normalized;
}

export function addTodo(
  items: readonly TodoItem[],
  title: string,
  createId: () => string = () => (
    `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  ),
): readonly TodoItem[] {
  if (items.length >= TODO_LIMIT) throw new Error("todo_limit");
  const id = createId().trim();
  if (!isNormalizedText(id, TODO_ID_MAX_CODE_POINTS)) {
    throw new Error("todo_id");
  }
  return [
    ...items,
    { id, title: assertTodoTitle(title), completed: false },
  ];
}

export function renameTodo(
  items: readonly TodoItem[],
  id: string,
  title: string,
): readonly TodoItem[] {
  const normalized = assertTodoTitle(title);
  return items.map((item) => item.id === id
    ? { ...item, title: normalized }
    : item);
}

export function deleteTodo(
  items: readonly TodoItem[],
  id: string,
): readonly TodoItem[] {
  if (items.length <= 1 && items.some((item) => item.id === id)) {
    throw new Error("todo_last_item");
  }
  return items.filter((item) => item.id !== id);
}

export async function resolveTodos(
  storage: EvenStorage,
): Promise<readonly TodoItem[]> {
  const cached = await readCache(storage, "todos", isTodoList);
  return cloneTodos(cached ?? DEFAULT_TODOS);
}

export function toggleTodo(
  items: readonly TodoItem[],
  index: number,
): readonly TodoItem[] {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    return items;
  }
  return items.map((item, itemIndex) => itemIndex === index
    ? { ...item, completed: !item.completed }
    : item);
}

export function writeTodos(
  storage: EvenStorage,
  items: readonly TodoItem[],
): Promise<boolean> {
  return writeCache(storage, "todos", cloneTodos(items));
}
