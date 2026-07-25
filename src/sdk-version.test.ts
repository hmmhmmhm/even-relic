import { describe, expect, it } from "vitest";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the latest SDK and matches the app minimum version", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];
    expect(installed).toBe("0.0.12");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(packageManifest.scripts.qr).toContain(`sdk=${installed}`);
    expect(packageManifest.scripts.qr).toContain("/diagnostic-v11");
    expect(packageManifest.scripts.qr).toContain("build=png8-1");
  });
});
