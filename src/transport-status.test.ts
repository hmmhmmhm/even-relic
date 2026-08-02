import { describe, expect, it } from "vitest";
import { TRANSPORT_STATUS, transportStatusKey } from "./transport-status";

describe("transportStatusKey", () => {
  it("maps stable runtime codes to localized presentation keys", () => {
    expect(transportStatusKey(TRANSPORT_STATUS.preparing)).toBe("ready");
    expect(transportStatusKey(TRANSPORT_STATUS.disabled)).toBe("disabled");
    expect(transportStatusKey(TRANSPORT_STATUS.active)).toBe("active");
    expect(transportStatusKey(TRANSPORT_STATUS.error)).toBe("unavailable");
  });

  it("keeps technical transport failures out of the user-facing status", () => {
    expect(transportStatusKey("sandevistanTR send failed: sendFailed"))
      .toBe("unavailable");
    expect(transportStatusKey("encode exploded")).toBe("unavailable");
    expect(transportStatusKey("tile timed out after 12000ms"))
      .toBe("unavailable");
  });
});
