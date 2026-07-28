import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the LZ4 0.0.12 SDK for the isolated image transport gate", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

    expect(installed).toBe("0.0.12");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(packageManifest.scripts.qr).toBe(
      'evenhub qr --url "http://localhost:4177/hud-canvas-fast?sdk=0.0.12&build=sdk-0012-repro-033"',
    );
  });

  it("marks encoded-image payloads for LZ4 bridge compression", () => {
    const payload = new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: new Uint8Array([1, 2, 3]),
    }).toJson();

    expect(payload).toEqual({
      compressMode: 2,
      containerID: 3,
      containerName: "frame",
      imageData: [1, 2, 3],
    });
  });
});
