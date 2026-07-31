import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the hardware-compatible 0.0.11 SDK after the LZ4 gate failure", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

    expect(installed).toBe("0.0.11");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(packageManifest.scripts.qr).toBe(
      'evenhub qr --url "http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040"',
    );
  });

  it("serializes image bytes without the rejected LZ4 transport flag", () => {
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

  it("exposes isolated pipeline two through four hardware QR scripts", () => {
    const scripts = packageManifest.scripts as Record<string, string>;

    expect(scripts["qr:pipeline2"]).toContain(
      "sdk=0.0.11&pipeline=2&build=pipeline-2-036",
    );
    expect(scripts["qr:pipeline2"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(scripts["qr:pipeline3"]).toContain(
      "sdk=0.0.11&pipeline=3&build=pipeline-3-037",
    );
    expect(scripts["qr:pipeline3"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(scripts["qr:pipeline4"]).toContain(
      "sdk=0.0.11&pipeline=4&build=pipeline-4-038",
    );
    expect(scripts["qr:pipeline4"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(scripts["qr:palette4"]).toContain(
      "sdk=0.0.11&pipeline=4&levels=4&build=palette-4-039",
    );
    expect(scripts["qr:palette4"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(scripts["qr:rollback"]).toContain(
      "sdk=0.0.11&pipeline=1&levels=original"
        + "&build=rollback-serial-original-040",
    );
    expect(scripts["qr:rollback"]).toContain(
      "http://100.127.255.11:4177/",
    );
  });
});
