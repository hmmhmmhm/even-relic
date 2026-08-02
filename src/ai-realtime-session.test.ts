import { describe, expect, it, vi } from "vitest";
import type { EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { AudioInputSource } from "@evenrealities/even_hub_sdk";
import { createAiRealtimeSession } from "./ai-realtime-session";
import type { AiWebSearchResult } from "./ai-tools";

class FakeSocket {
  readyState = 0;
  readonly sent: string[] = [];
  readonly protocols: string[];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(protocols: string[]) {
    this.protocols = protocols;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  server(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }
  fail() {
    this.onerror?.();
  }
  send(value: string) {
    this.sent.push(value);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("G2 Realtime session", () => {
  it("cancels the active response without closing the glasses microphone", async () => {
    const audioControl = vi.fn(async () => true);
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    socket?.server({ type: "response.created", response: { id: "r1" } });
    socket?.server({
      type: "response.output_text.delta",
      response_id: "r1",
      delta: "부분 답변",
    });

    expect(session.cancelResponse()).toMatchObject({
      phase: "listening",
      assistantText: "부분 답변",
      retiredResponseIds: ["r1"],
    });
    expect(JSON.parse(socket?.sent.at(-1) ?? "{}")).toEqual({
      type: "response.cancel",
      response_id: "r1",
    });
    expect(audioControl).not.toHaveBeenCalledWith(false);

    socket?.server({
      type: "response.output_text.delta",
      response_id: "r1",
      delta: " 늦은 내용",
    });
    expect(session.getState().assistantText).toBe("부분 답변");
    await session.stop();
  });

  it("suppresses a response that is created after an early cancellation", async () => {
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    socket?.server({ type: "input_audio_buffer.speech_stopped" });

    const sentBeforeCancel = socket?.sent.length ?? 0;
    expect(session.cancelResponse()).toMatchObject({ phase: "listening" });
    expect(socket?.sent).toHaveLength(sentBeforeCancel);
    socket?.server({ type: "response.created", response: { id: "late-r1" } });
    expect(JSON.parse(socket?.sent.at(-1) ?? "{}")).toEqual({
      type: "response.cancel",
      response_id: "late-r1",
    });
    socket?.server({ type: "response.cancelled", response: { id: "late-r1" } });
    socket?.server({
      type: "response.output_text.delta",
      response_id: "late-r1",
      delta: "취소 뒤 늦은 답변",
    });

    expect(session.getState()).toMatchObject({
      phase: "listening",
      assistantText: "",
    });
    await session.stop();
  });

  it("does not open a socket or microphone after stop wins a pending start", async () => {
    const audioControl = vi.fn(async () => true);
    let releaseToken: ((response: Response) => void) | undefined;
    const tokenResponse = new Promise<Response>((resolve) => {
      releaseToken = resolve;
    });
    const createSocket = vi.fn((_url: string, protocols: string[]) => {
      const socket = new FakeSocket(protocols);
      queueMicrotask(() => socket.open());
      return socket;
    });
    let requestSignal: AbortSignal | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: vi.fn(async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return tokenResponse;
      }),
      createSocket,
    });

    const starting = session.start();
    await session.stop();
    expect(requestSignal?.aborted).toBe(true);
    releaseToken?.(Response.json({
      value: "ek_test_ephemeral_123456",
      expiresAt: 1_800_000_000,
      model: "gpt-realtime",
    }));

    await expect(starting).rejects.toThrow("cancelled");
    expect(createSocket).not.toHaveBeenCalled();
    expect(audioControl).not.toHaveBeenCalledWith(
      true,
      AudioInputSource.Glasses,
    );
  });

  it("starts the glasses microphone only after an explicit, open session", async () => {
    const audioControl = vi.fn(async () => true);
    let eventListener: ((event: EvenHubEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    const bridge = {
      audioControl,
      onEvenHubEvent(listener: (event: EvenHubEvent) => void) {
        eventListener = listener;
        return unsubscribe;
      },
    };
    let socket: FakeSocket | undefined;
    const states: string[] = [];
    const eventTypes: (string | undefined)[] = [];
    const session = createAiRealtimeSession({
      bridge,
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      fetchImpl: async (_input, init) => {
        expect((init?.headers as Record<string, string>)[
          "x-sandevistan-openai-key"
        ]).toContain("sk-test-");
        return Response.json({
          value: "ek_test_ephemeral_123456",
          expiresAt: 1_800_000_000,
          model: "gpt-realtime",
        });
      },
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
      onState: (state, eventType) => {
        states.push(state.phase);
        eventTypes.push(eventType);
      },
    });

    expect(audioControl).not.toHaveBeenCalled();
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    expect(audioControl).not.toHaveBeenCalled();
    expect(socket?.protocols).toContain("realtime");
    expect(socket?.protocols.join(" ")).toContain("ek_test_ephemeral_123456");
    socket?.open();
    await starting;

    expect(audioControl).toHaveBeenCalledWith(
      true,
      AudioInputSource.Glasses,
    );
    expect(JSON.parse(socket?.sent[0] ?? "{}").type).toBe("session.update");
    eventListener?.({
      audioEvent: {
        audioPcm: new Uint8Array([0, 0, 232, 3]),
        source: AudioInputSource.Glasses,
      },
    });
    const append = JSON.parse(socket?.sent.at(-1) ?? "{}") as {
      type?: string;
      audio?: string;
    };
    expect(append.type).toBe("input_audio_buffer.append");
    expect(atob(append.audio ?? "")).toHaveLength(6);
    expect(states).toContain("listening");
    socket?.server({ type: "input_audio_buffer.speech_started" });
    socket?.server({ type: "response.done", response: { id: "r1" } });
    expect(eventTypes).toContain("response.done");

    await session.stop();
    expect(audioControl).toHaveBeenLastCalledWith(false);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(socket?.readyState).toBe(3);
  });

  it("cleans up the microphone when the server reports an error", async () => {
    const audioControl = vi.fn(async () => true);
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    socket?.server({ type: "error", error: { message: "failed" } });
    await vi.waitFor(() => (
      expect(audioControl).toHaveBeenLastCalledWith(false)
    ));
  });

  it("cleans up an already-open microphone on a socket transport error", async () => {
    const audioControl = vi.fn(async () => true);
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;

    socket?.fail();

    await vi.waitFor(() => (
      expect(audioControl).toHaveBeenLastCalledWith(false)
    ));
  });

  it("retries microphone cleanup during stop and then resolves", async () => {
    let closeAttempts = 0;
    const audioControl = vi.fn(async (isOpen: boolean) => {
      if (isOpen) return true;
      closeAttempts += 1;
      return closeAttempts >= 2;
    });
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;

    await expect(session.stop()).resolves.toMatchObject({ phase: "idle" });
    expect(closeAttempts).toBe(2);
  });

  it("waits for a pending microphone activation and closes it before stop resolves", async () => {
    let releaseMicrophone: ((opened: boolean) => void) | undefined;
    const activation = new Promise<boolean>((resolve) => {
      releaseMicrophone = resolve;
    });
    const audioControl = vi.fn(async (isOpen: boolean) => (
      isOpen ? activation : true
    ));
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await vi.waitFor(() => expect(audioControl).toHaveBeenCalledWith(
      true,
      AudioInputSource.Glasses,
    ));

    let stopped = false;
    const stopping = session.stop().then(() => { stopped = true; });
    const earlyResult = await Promise.race([
      stopping.then(() => "stopped" as const),
      new Promise<"pending">((resolve) => {
        setTimeout(() => resolve("pending"), 10);
      }),
    ]);
    expect(earlyResult).toBe("pending");
    expect(stopped).toBe(false);
    releaseMicrophone?.(true);

    await stopping;
    await expect(starting).rejects.toThrow("cancelled");
    expect(audioControl).toHaveBeenLastCalledWith(false);
    expect(session.getState().phase).not.toBe("listening");
  });

  it("closes a microphone that finishes opening after a socket error", async () => {
    let releaseMicrophone: ((opened: boolean) => void) | undefined;
    const activation = new Promise<boolean>((resolve) => {
      releaseMicrophone = resolve;
    });
    const audioControl = vi.fn(async (isOpen: boolean) => (
      isOpen ? activation : true
    ));
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await vi.waitFor(() => expect(audioControl).toHaveBeenCalledWith(
      true,
      AudioInputSource.Glasses,
    ));

    socket?.fail();
    releaseMicrophone?.(true);

    await expect(starting).rejects.toThrow("cancelled");
    await vi.waitFor(() => (
      expect(audioControl).toHaveBeenLastCalledWith(false)
    ));
    expect(session.getState().phase).toBe("error");
  });

  it("releases transport and returns idle even when microphone closure is unconfirmed", async () => {
    const audioControl = vi.fn(async (isOpen: boolean) => isOpen);
    const order: string[] = [];
    const unsubscribe = vi.fn(() => { order.push("unsubscribe"); });
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: async (isOpen) => {
          if (!isOpen) order.push("microphone");
          return audioControl(isOpen);
        },
        onEvenHubEvent: () => unsubscribe,
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        const close = socket.close.bind(socket);
        socket.close = () => {
          order.push("socket");
          close();
        };
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;

    await expect(session.stop()).resolves.toMatchObject({
      phase: "idle",
      error: undefined,
    });
    expect(order.slice(0, 2)).toEqual(["unsubscribe", "socket"]);
    expect(order.filter((value) => value === "microphone")).toHaveLength(2);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(socket?.readyState).toBe(3);
    expect(session.getState()).toMatchObject({
      phase: "idle",
      error: undefined,
    });
  });

  it("executes each built-in function call once and continues the response", async () => {
    let socket: FakeSocket | undefined;
    let finishSearch: ((value: AiWebSearchResult) => void) | undefined;
    const searchWeb = vi.fn(() => new Promise<AiWebSearchResult>((resolve) => {
      finishSearch = resolve;
    }));
    const toolStates: Array<unknown> = [];
    const result = {
      answer: "Current result [1]",
      sources: [{ title: "Source", url: "https://example.com/source" }],
      usage: {
        model: "gpt-5.5",
        inputTokens: 3,
        cachedInputTokens: 1,
        outputTokens: 4,
        webSearchCalls: 1,
      },
    } satisfies AiWebSearchResult;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      getLocation: () => ({ status: "unavailable" }),
      searchWeb,
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
      onState: (state) => toolStates.push(state.activeTool),
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    const event = {
      type: "response.done",
      response: {
        id: "r-tools",
        output: [{
          type: "function_call",
          name: "search_web",
          call_id: "call-1",
          arguments: JSON.stringify({ query: "current result" }),
        }],
      },
    };
    socket?.server(event);
    socket?.server(event);

    await vi.waitFor(() => expect(searchWeb).toHaveBeenCalledOnce());
    expect(session.getState().activeTool).toEqual({
      id: "call-1",
      kind: "web-search",
    });
    finishSearch?.(result);
    await vi.waitFor(() => expect(socket?.sent.some((raw) => {
      const sent = JSON.parse(raw);
      return sent.type === "conversation.item.create"
        && sent.item?.type === "function_call_output"
        && sent.item?.call_id === "call-1";
    })).toBe(true));
    expect(socket?.sent.filter((raw) => JSON.parse(raw).type === "response.create"))
      .toHaveLength(1);
    expect(session.getState().sources).toEqual([
      { title: "Source", url: "https://example.com/source" },
    ]);
    expect(session.getState().activeTool).toBeUndefined();
    expect(toolStates).toContainEqual({ id: "call-1", kind: "web-search" });
    expect(session.getState().usage).toMatchObject({
      searchTextInputTokens: 2,
      cachedSearchTextInputTokens: 1,
      searchTextOutputTokens: 4,
      webSearchCalls: 1,
    });
    expect(session.getState().charge.estimatedNanoUsd).toBeGreaterThan(0);
    await session.stop();
  });

  it("requires a tap approval for MCP calls and rejects a pending call on stop", async () => {
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      mcpServers: [{
        id: "docs",
        name: "Docs MCP",
        url: "https://mcp.example.com/sse",
        allowedTools: [],
        enabled: true,
      }],
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    socket?.server({
      type: "conversation.item.done",
      item: {
        type: "mcp_approval_request",
        id: "approval-1",
        server_label: "mcp_docs",
        name: "search",
        arguments: "{\"query\":\"private\"}",
      },
    });
    expect(session.getState().pendingApproval).toMatchObject({
      id: "approval-1",
      serverName: "Docs MCP",
      toolName: "search",
    });
    expect(session.approvePendingMcp?.()).toBe(true);
    expect(JSON.parse(socket?.sent.at(-1) ?? "{}")).toEqual({
      type: "conversation.item.create",
      item: {
        type: "mcp_approval_response",
        approval_request_id: "approval-1",
        approve: true,
      },
    });
    socket?.server({
      type: "response.mcp_call.in_progress",
      item_id: "mcp-call-1",
      name: "search",
      server_label: "mcp_docs",
    });
    expect(session.getState().activeTool).toEqual({
      id: "mcp-call-1",
      kind: "mcp",
      displayName: "search",
    });
    socket?.server({
      type: "response.output_item.done",
      item: {
        type: "mcp_call",
        id: "mcp-call-1",
        name: "search",
        server_label: "mcp_docs",
        status: "completed",
      },
    });
    expect(session.getState().activeTool).toBeUndefined();

    socket?.server({
      type: "conversation.item.done",
      item: {
        type: "mcp_approval_request",
        id: "approval-2",
        server_label: "mcp_docs",
        name: "read",
        arguments: "{}",
      },
    });
    await session.stop();
    expect(socket?.sent.some((raw) => {
      const sent = JSON.parse(raw);
      return sent.item?.approval_request_id === "approval-2"
        && sent.item?.approve === false;
    })).toBe(true);
  });
});
