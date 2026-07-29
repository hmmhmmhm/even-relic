import { useEffect, useState, type FormEvent } from "react";
import type { EvenStorage } from "../live-cache";
import type { TodoItem } from "../live-state";
import type { PhoneStringKey } from "../phone-i18n";
import { PhoneIcon } from "../phone-icons";
import {
  addTodo,
  deleteTodo,
  renameTodo,
  toggleTodo,
  writeTodos,
} from "../todos";

export function TodoScreen({
  items,
  storage,
  t,
  onChange,
}: {
  readonly items: readonly TodoItem[];
  readonly storage?: EvenStorage;
  readonly t: (key: PhoneStringKey) => string;
  readonly onChange: (items: readonly TodoItem[]) => void;
}) {
  const [local, setLocal] = useState(items);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => setLocal(items), [items]);

  const commit = async (next: readonly TodoItem[]) => {
    if (!storage || busy) return false;
    setBusy(true);
    const saved = await writeTodos(storage, next);
    if (saved) {
      setLocal(next);
      onChange(next);
      setError(undefined);
    } else {
      setError(t("storageFailed"));
    }
    setBusy(false);
    return saved;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const next = addTodo(local, title);
      void commit(next).then((saved) => {
        if (saved) setTitle("");
      });
    } catch (caught) {
      setError(caught instanceof Error && caught.message === "todo_limit"
        ? t("taskLimit")
        : t("validationFailed"));
    }
  };

  const remove = (id: string) => {
    if (confirming !== id) {
      setConfirming(id);
      setError(t("confirmDelete"));
      return;
    }
    try {
      void commit(deleteTodo(local, id)).then((saved) => {
        if (saved) setConfirming(undefined);
      });
    } catch {
      setError(t("validationFailed"));
    }
  };

  return (
    <div className="phone-detail-stack">
      <form className="phone-inline-form" onSubmit={submit}>
        <label>
          <span className="phone-visually-hidden">{t("taskTitle")}</span>
          <input
            value={title}
            maxLength={40}
            disabled={busy || local.length >= 6}
            placeholder={t("taskTitle")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy || !title.trim()}>
          <PhoneIcon name="plus" size={22} />
          <span className="phone-visually-hidden">{t("addTask")}</span>
        </button>
      </form>
      <section className="phone-panel phone-item-list">
        {local.map((item, index) => (
          <div className="phone-item-row" key={item.id}>
            <button
              type="button"
              className="phone-check-button"
              aria-pressed={item.completed}
              disabled={busy}
              onClick={() => void commit(toggleTodo(local, index))}
            >
              <PhoneIcon
                name={item.completed ? "checkbox" : "checkboxOn"}
                size={24}
              />
              <span className="phone-visually-hidden">
                {item.completed ? t("enabled") : t("disabled")}
              </span>
            </button>
            {editing === item.id ? (
              <input
                autoFocus
                defaultValue={item.title}
                maxLength={40}
                onBlur={(event) => {
                  try {
                    void commit(renameTodo(local, item.id, event.target.value));
                  } catch {
                    setError(t("validationFailed"));
                  }
                  setEditing(undefined);
                }}
              />
            ) : (
              <span className={item.completed ? "is-complete" : ""}>
                {item.title}
              </span>
            )}
            <button
              type="button"
              className="phone-icon-button"
              aria-label={`${t("edit")} ${item.title}`}
              onClick={() => setEditing(item.id)}
            >
              <PhoneIcon name="edit" size={20} />
            </button>
            <button
              type="button"
              className="phone-icon-button"
              aria-label={`${t("delete")} ${item.title}`}
              onClick={() => remove(item.id)}
            >
              <PhoneIcon name="trash" size={20} />
            </button>
          </div>
        ))}
      </section>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
    </div>
  );
}
