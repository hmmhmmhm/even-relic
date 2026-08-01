import {
  executeBuiltinAiTool,
  type AiCitationSource,
  type AiWebSearchResult,
} from "./ai-tools";
import type { DataState, LocationValue } from "./live-state";
import type { McpServerConfig } from "./mcp-servers";
import type { PhoneLocale } from "./phone-types";

type FunctionCall = {
  readonly callId: string;
  readonly name: string;
  readonly arguments: string;
};

export type AiMcpApproval = {
  readonly id: string;
  readonly serverLabel: string;
  readonly serverName: string;
  readonly toolName: string;
  readonly argumentsSummary: string;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

export function responseFunctionCalls(event: unknown): readonly FunctionCall[] {
  const response = record(record(event)?.response);
  if (!Array.isArray(response?.output)) return [];
  return response.output.flatMap((value) => {
    const item = record(value);
    return item?.type === "function_call"
      && typeof item.call_id === "string"
      && typeof item.name === "string"
      && typeof item.arguments === "string"
      ? [{
          callId: item.call_id.slice(0, 128),
          name: item.name.slice(0, 96),
          arguments: item.arguments,
        }]
      : [];
  });
}

export function mcpApprovalRequest(
  event: unknown,
  servers: readonly McpServerConfig[],
): AiMcpApproval | undefined {
  const envelope = record(event);
  if (envelope?.type !== "conversation.item.done") return undefined;
  const item = record(envelope.item);
  if (
    item?.type !== "mcp_approval_request"
    || typeof item.id !== "string"
    || typeof item.server_label !== "string"
    || typeof item.name !== "string"
  ) return undefined;
  const match = servers.find(({ id }) => `mcp_${id}` === item.server_label);
  return {
    id: item.id.slice(0, 128),
    serverLabel: item.server_label.slice(0, 80),
    serverName: match?.name ?? item.server_label.slice(0, 80),
    toolName: item.name.slice(0, 96),
    argumentsSummary: typeof item.arguments === "string"
      ? item.arguments.replace(/\s+/g, " ").trim().slice(0, 180)
      : "{}",
  };
}

export function mcpApprovalResponse(id: string, approve: boolean) {
  return {
    type: "conversation.item.create" as const,
    item: {
      type: "mcp_approval_response" as const,
      approval_request_id: id,
      approve,
    },
  };
}

export function createAiRealtimeToolRunner(options: {
  readonly locale: PhoneLocale;
  readonly now: () => Date;
  readonly getLocation: () => DataState<LocationValue>;
  readonly searchWeb: (
    query: string,
    locale: PhoneLocale,
    signal: AbortSignal,
  ) => Promise<AiWebSearchResult>;
  readonly send: (event: unknown) => void;
  readonly onSources: (sources: readonly AiCitationSource[]) => void;
  readonly onSearchUsage: (usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly webSearchCalls: number;
  }) => void;
}) {
  const completed = new Set<string>();
  let active: AbortController | undefined;

  return {
    handle(event: unknown): boolean {
      const calls = responseFunctionCalls(event).filter(({ callId }) => (
        !completed.has(callId)
      ));
      if (calls.length === 0 || active) return false;
      const controller = new AbortController();
      active = controller;
      for (const call of calls) completed.add(call.callId);
      void Promise.all(calls.map(async (call) => {
        const result = await executeBuiltinAiTool(call.name, call.arguments, {
          locale: options.locale,
          now: options.now,
          getLocation: options.getLocation,
          searchWeb: (query, locale) => options.searchWeb(
            query,
            locale,
            controller.signal,
          ),
        });
        if (controller.signal.aborted) return;
        if (result.ok && result.sources?.length) {
          options.onSources(result.sources);
        }
        if (result.ok && result.usage) options.onSearchUsage(result.usage);
        options.send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: call.callId,
            output: JSON.stringify(result),
          },
        });
      })).then(() => {
        if (!controller.signal.aborted) options.send({ type: "response.create" });
      }).finally(() => {
        if (active === controller) active = undefined;
      });
      return true;
    },
    cancel() {
      active?.abort();
      active = undefined;
    },
  };
}
