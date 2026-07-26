import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the 0.0.10 A/B SDK across dependency, manifest, and QR metadata", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

    expect(installed).toBe("0.0.10");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(packageManifest.scripts.qr).toContain(
      "http://100.96.68.73:4173/diagnostic-v10",
    );
    expect(packageManifest.scripts.qr).toContain("sdk=0.0.10");
    expect(packageManifest.scripts.qr).toContain("build=sdk-0010-ab");
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
