import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the G2-compatible SDK and identifies the 400x200 HUD build", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];
    expect(installed).toBe("0.0.11");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(packageManifest.scripts.qr).toContain(`sdk=${installed}`);
    expect(packageManifest.scripts.qr).toContain("/hud-density-v2");
    expect(packageManifest.scripts.qr).toContain("build=hud400-text3s");
  });

  it("serializes raw image updates without the rejected LZ4 mode", () => {
    const update = new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: Uint8Array.from([1, 2, 3]),
    });

    expect(update.toJson()).not.toHaveProperty("compressMode");
  });
});
