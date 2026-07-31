import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the promoted 0.0.13 SDK and its minimum Even App version", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

    expect(installed).toBe("0.0.13");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(appManifest.min_app_version).toBe("2.2.6");
    expect(packageManifest.scripts.qr).toBe(
      'evenhub qr --url "http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&build=array-default-sdk0013-046"',
    );
  });

  it("serializes image bytes with the repaired LZ4 transport flag", () => {
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

  it("keeps every main hardware QR script on the promoted SDK", () => {
    const scripts = packageManifest.scripts as Record<string, string>;

    expect(scripts["qr:pipeline2"]).toContain(
      "sdk=0.0.13&pipeline=2&build=pipeline-2-sdk0013-043",
    );
    expect(scripts["qr:pipeline2"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(scripts["qr:pipeline3"]).toContain(
      "sdk=0.0.13&pipeline=3&build=pipeline-3-sdk0013-043",
    );
    expect(scripts["qr:pipeline3"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(scripts["qr:pipeline4"]).toContain(
      "sdk=0.0.13&pipeline=4&build=pipeline-4-sdk0013-043",
    );
    expect(scripts["qr:pipeline4"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(scripts["qr:palette4"]).toContain(
      "sdk=0.0.13&pipeline=4&levels=4&build=palette-4-sdk0013-043",
    );
    expect(scripts["qr:palette4"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(scripts["qr:rollback"]).toContain(
      "sdk=0.0.13&pipeline=1&levels=original"
        + "&build=rollback-serial-original-sdk0013-043",
    );
    expect(scripts["qr:rollback"]).toContain(
      "http://100.127.255.11:4177/",
    );
    expect(Object.values(scripts).filter((script) => script.includes("evenhub qr")))
      .not.toContain(expect.stringContaining("sdk=0.0.11"));
  });
});
