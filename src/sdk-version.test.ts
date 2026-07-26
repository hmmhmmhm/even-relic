import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the pre-LZ4 0.0.11 SDK for the fast HUD gate", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

    expect(installed).toBe("0.0.11");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(packageManifest.scripts.qr).toContain(
      "http://100.96.68.73:4176/hud-canvas-fast",
    );
    expect(packageManifest.scripts.qr).toContain("sdk=0.0.11");
    expect(packageManifest.scripts.qr).toContain("build=fast-live-011");
  });

  it("serializes image bytes without the 0.0.12 LZ4 transport flag", () => {
    const payload = new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: new Uint8Array([1, 2, 3]),
    }).toJson();

    expect(payload).toEqual({
      containerID: 3,
      containerName: "frame",
      imageData: [1, 2, 3],
    });
  });
});
