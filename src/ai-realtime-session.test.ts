import { describe, expect, it, vi } from "vitest";
import type { EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { AudioInputSource } from "@evenrealities/even_hub_sdk";
import { createAiRealtimeSession } from "./ai-realtime-session";

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
      onState: (state) => states.push(state.phase),
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

  it("retries microphone cleanup when pausing cannot confirm closure", async () => {
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

    await expect(session.pause()).rejects.toThrow("microphone");
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

  it("does not report a successful stop when the open microphone cannot close", async () => {
    const audioControl = vi.fn(async (isOpen: boolean) => isOpen);
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

    await expect(session.stop()).rejects.toThrow("microphone");
    expect(session.getState()).toMatchObject({
      phase: "error",
      error: "G2 microphone could not close",
    });
  });
});
