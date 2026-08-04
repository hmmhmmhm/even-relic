import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the stable 0.0.11 fallback and its minimum Even App version", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

    expect(installed).toBe("0.0.11");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(appManifest.min_app_version).toBe("2.2.6");
    expect(packageManifest.scripts.qr).toBe(
      'evenhub qr --url "http://100.127.255.11:4179/hud-canvas-fast?sdk=0.0.11&build=sdk0011-current-063"',
    );
  });

  it("omits the unstable compressed-image transport flag", () => {
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

  it("declares the scoped G2 microphone and OpenAI network permissions", () => {
    const permissions = appManifest.permissions as Array<{
      name: string;
      whitelist?: string[];
    }>;
    expect(permissions.some(({ name }) => name === "g2-microphone")).toBe(true);
    expect(permissions.find(({ name }) => name === "network")?.whitelist)
      .toEqual(expect.arrayContaining([
        "https://api.openai.com",
        "wss://api.openai.com",
      ]));
  });

  it("uses only language codes accepted by the Even Hub manifest", () => {
    expect(appManifest.supported_languages).toEqual([
      "en", "de", "fr", "es", "it", "zh", "ja", "ko",
    ]);
  });

  it("keeps every main hardware QR script on the promoted SDK", () => {
    const scripts = packageManifest.scripts as Record<string, string>;
    const qrScripts = Object.values(scripts).filter((script) => (
      script.includes("evenhub qr")
    ));

    expect(scripts["qr:pipeline2"]).toContain(
      "sdk=0.0.11&pipeline=2&build=pipeline-2-sdk0011-063",
    );
    expect(scripts["qr:pipeline2"]).toContain(
      "http://100.127.255.11:4179/",
    );
    expect(scripts["qr:pipeline3"]).toContain(
      "sdk=0.0.11&pipeline=3&build=pipeline-3-sdk0011-063",
    );
    expect(scripts["qr:pipeline3"]).toContain(
      "http://100.127.255.11:4179/",
    );
    expect(scripts["qr:pipeline4"]).toContain(
      "sdk=0.0.11&pipeline=4&build=pipeline-4-sdk0011-063",
    );
    expect(scripts["qr:pipeline4"]).toContain(
      "http://100.127.255.11:4179/",
    );
    expect(scripts["qr:palette4"]).toContain(
      "sdk=0.0.11&pipeline=4&levels=4&build=palette-4-sdk0011-063",
    );
    expect(scripts["qr:palette4"]).toContain(
      "http://100.127.255.11:4179/",
    );
    expect(scripts["qr:rollback"]).toContain(
      "sdk=0.0.11&pipeline=1&levels=original"
        + "&build=rollback-serial-original-sdk0011-063",
    );
    expect(scripts["qr:rollback"]).toContain(
      "http://100.127.255.11:4179/",
    );
    expect(qrScripts).toHaveLength(8);
    expect(qrScripts).toEqual(expect.arrayContaining([
      expect.stringContaining("http://100.127.255.11:4179/"),
    ]));
    expect(qrScripts.every((script) => (
      script.includes("http://100.127.255.11:4179/")
    ))).toBe(true);
    expect(qrScripts)
      .not.toContain(expect.stringContaining("sdk=0.0.13"));
  });
});
