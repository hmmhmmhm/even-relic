import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  maskMcpAuthorization,
  projectRealtimeMcpTools,
  resolveMcpServers,
  validateMcpServer,
  writeMcpServers,
} from "./mcp-servers";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

const candidate = {
  id: "docs",
  name: "Docs MCP",
  url: "https://mcp.example.com/sse",
  authorization: "secret-value",
  allowedTools: ["search", "read_doc"],
  enabled: true,
} as const;

describe("MCP server configuration", () => {
  it("accepts bounded HTTPS servers and rejects unsafe input", () => {
    expect(validateMcpServer(candidate)).toEqual({ ok: true, value: candidate });
    expect(validateMcpServer({ ...candidate, url: "http://localhost:3000" }).ok)
      .toBe(false);
    expect(validateMcpServer({ ...candidate, authorization: "bad\nheader" }).ok)
      .toBe(false);
    expect(validateMcpServer({ ...candidate, allowedTools: ["bad tool"] }).ok)
      .toBe(false);
  });

  it("stores only valid bounded entries and masks authorization", async () => {
    const storage = new TestStorage();
    await expect(writeMcpServers(storage, [candidate])).resolves.toBe(true);
    await expect(resolveMcpServers(storage)).resolves.toEqual([candidate]);
    expect(maskMcpAuthorization(candidate.authorization)).toBe("secr••••alue");
    expect([...storage.values.keys()]).toEqual(["sandevistan:mcp-servers:v1"]);
  });

  it("projects enabled servers into always-approved Realtime MCP tools", () => {
    expect(projectRealtimeMcpTools([
      candidate,
      { ...candidate, id: "off", enabled: false },
    ])).toEqual([{
      type: "mcp",
      server_label: "mcp_docs",
      server_url: candidate.url,
      authorization: candidate.authorization,
      allowed_tools: candidate.allowedTools,
      require_approval: "always",
      server_description: candidate.name,
    }]);
  });
});
