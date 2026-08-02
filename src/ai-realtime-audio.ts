function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    output += alphabet[(value >> 18) & 63];
    output += alphabet[(value >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(value >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[value & 63] : "=";
  }
  return output;
}

export function createAudioAppendEvent(bytes: Uint8Array) {
  return {
    type: "input_audio_buffer.append" as const,
    audio: bytesToBase64(bytes),
  };
}

export function resamplePcm16Le16To24(bytes: Uint8Array): Uint8Array {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  if (sampleCount === 0) return new Uint8Array();
  const input = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    sampleCount * 2,
  );
  const outputSampleCount = Math.round(sampleCount * 1.5);
  const output = new Uint8Array(outputSampleCount * 2);
  const view = new DataView(output.buffer);
  for (let index = 0; index < outputSampleCount; index += 1) {
    const position = index * 2 / 3;
    const lowerIndex = Math.min(Math.floor(position), sampleCount - 1);
    const upperIndex = Math.min(lowerIndex + 1, sampleCount - 1);
    const ratio = position - lowerIndex;
    const lower = input.getInt16(lowerIndex * 2, true);
    const upper = input.getInt16(upperIndex * 2, true);
    const sample = Math.max(
      -32_768,
      Math.min(32_767, Math.round(lower + (upper - lower) * ratio)),
    );
    view.setInt16(index * 2, sample, true);
  }
  return output;
}
