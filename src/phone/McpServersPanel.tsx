import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EvenStorage } from "../live-cache";
import {
  maskMcpAuthorization,
  resolveMcpServers,
  validateMcpServer,
  writeMcpServers,
  type McpServerConfig,
} from "../mcp-servers";
import type { PhoneStringKey } from "../phone-i18n";

function serverId(name: string, servers: readonly McpServerConfig[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 36) || "server";
  let id = base;
  let suffix = 2;
  while (servers.some((server) => server.id === id)) {
    id = `${base}-${suffix}`.slice(0, 48);
    suffix += 1;
  }
  return id;
}

export function McpServersPanel({
  storage,
  t,
}: {
  readonly storage?: EvenStorage;
  readonly t: (key: PhoneStringKey) => string;
}) {
  const [servers, setServers] = useState<readonly McpServerConfig[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [tools, setTools] = useState("");
  const [error, setError] = useState<string>();
  const revision = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = revision.current;
    if (!storage) return;
    void resolveMcpServers(storage).then((value) => {
      if (!cancelled && revision.current === startedAt) setServers(value);
    });
    return () => { cancelled = true; };
  }, [storage]);

  const reset = () => {
    setEditingId(undefined);
    setName("");
    setUrl("");
    setToken("");
    setTools("");
    setError(undefined);
  };

  const persist = async (next: readonly McpServerConfig[]) => {
    revision.current += 1;
    if (!storage || !await writeMcpServers(storage, next)) {
      setError(t("storageFailed"));
      return false;
    }
    setServers(next);
    setError(undefined);
    return true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const previous = servers.find(({ id }) => id === editingId);
    const authorization = token.trim()
      ? token.trim().replace(/^Bearer\s+/i, "")
      : previous?.authorization;
    const validation = validateMcpServer({
      id: editingId ?? serverId(name, servers),
      name,
      url,
      ...(authorization ? { authorization } : {}),
      allowedTools: tools.split(",").map((value) => value.trim()).filter(Boolean),
      enabled: previous?.enabled ?? true,
    });
    if (!validation.ok) {
      setError(t("validationFailed"));
      return;
    }
    const next = editingId
      ? servers.map((server) => server.id === editingId
        ? validation.value
        : server)
      : [...servers, validation.value];
    if (await persist(next)) reset();
  };

  const edit = (server: McpServerConfig) => {
    setEditingId(server.id);
    setName(server.name);
    setUrl(server.url);
    setToken("");
    setTools(server.allowedTools.join(", "));
    setError(undefined);
  };

  return (
    <section className="phone-panel phone-mcp-panel">
      <div className="phone-mcp-heading">
        <h2>{t("mcpServers")}</h2>
        <p>{t("mcpHelp")}</p>
      </div>
      <div className="phone-mcp-list">
        {servers.length === 0 ? <p>{t("noMcpServers")}</p> : servers.map((server) => (
          <article key={server.id}>
            <label className="phone-mcp-toggle">
              <input
                type="checkbox"
                checked={server.enabled}
                onChange={() => void persist(servers.map((item) => (
                  item.id === server.id ? { ...item, enabled: !item.enabled } : item
                )))}
              />
              <span>{server.enabled ? t("enabled") : t("disabled")}</span>
            </label>
            <div>
              <strong>{server.name}</strong>
              <span>{server.url}</span>
              {server.authorization && <small>{maskMcpAuthorization(server.authorization)}</small>}
            </div>
            <div className="phone-mcp-actions">
              <button type="button" onClick={() => edit(server)}>{t("edit")}</button>
              <button type="button" onClick={() => void persist(
                servers.filter(({ id }) => id !== server.id),
              )}>{t("delete")}</button>
            </div>
          </article>
        ))}
      </div>
      <form className="phone-stacked-form" onSubmit={(event) => void submit(event)}>
        <label><span>{t("mcpServerName")}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>{t("mcpServerUrl")}</span><input type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <label><span>{t("mcpBearerToken")}</span><input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /></label>
        <label><span>{t("mcpAllowedTools")}</span><input value={tools} onChange={(event) => setTools(event.target.value)} /></label>
        <div className="phone-mcp-form-actions">
          {editingId && <button type="button" className="phone-text-button" onClick={reset}>{t("cancel")}</button>}
          <button type="submit" className="phone-primary-button">{editingId ? t("save") : t("add")}</button>
        </div>
      </form>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
    </section>
  );
}
