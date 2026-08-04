import { describe, expect, it, vi } from "vitest";
import { AudioInputSource, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createConversateRealtimeSession } from "./conversate-realtime-session";
import type { RealtimeSocket } from "./ai-realtime-transport";

describe("Conversate realtime transcription", () => {
  it("uses gpt-live-transcribe, publishes deltas, and closes the G2 microphone", async () => {
    const sent: string[] = [];
    let socket: RealtimeSocket | undefined;
    let listener: ((event: EvenHubEvent) => void) | undefined;
    const audioControl = vi.fn(async () => true);
    const partial = vi.fn();
    const completed = vi.fn();
    const session = createConversateRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent(next) { listener = next; return () => { listener = undefined; }; },
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      onPartial: partial,
      onCompleted: completed,
      onError: vi.fn(),
      fetchImpl: vi.fn(async () => Response.json({ value: "ek_test_ephemeral" })) as typeof fetch,
      createSocket: () => {
        socket = {
          readyState: 1,
          onopen: null, onmessage: null, onerror: null, onclose: null,
          send(value) { sent.push(value); },
          close() {},
        };
        queueMicrotask(() => socket?.onopen?.());
        return socket;
      },
    });
    await session.start();
    const update = sent.map((value) => JSON.parse(value)).find(({ type }) => type === "session.update");
    expect(update.session.audio.input.transcription).toMatchObject({
      model: "gpt-live-transcribe", delay: "low",
    });
    socket?.onmessage?.({ data: JSON.stringify({
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "item-1",
      delta: "안녕",
    }) } as MessageEvent<string>);
    socket?.onmessage?.({ data: JSON.stringify({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item-1",
      transcript: "안녕하세요",
    }) } as MessageEvent<string>);
    expect(partial).toHaveBeenCalledWith("item-1", "안녕");
    expect(completed).toHaveBeenCalledWith("item-1", "안녕하세요");
    listener?.({ audioEvent: {
      source: AudioInputSource.Glasses,
      audioPcm: new Uint8Array([0, 0, 1, 0]),
    } } as EvenHubEvent);
    expect(sent.map((value) => JSON.parse(value).type)).toContain("input_audio_buffer.append");
    await session.stop();
    expect(audioControl).toHaveBeenNthCalledWith(1, true, AudioInputSource.Glasses);
    expect(audioControl).toHaveBeenLastCalledWith(false);
  });
});
