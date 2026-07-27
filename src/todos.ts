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
