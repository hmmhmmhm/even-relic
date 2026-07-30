import { describe, expect, it } from "vitest";
import { LOCALE_REGISTRY } from "./i18n/locale-registry";
import {
  PHONE_STRINGS,
  resolvePhoneLocale,
  translatePhone,
} from "./phone-i18n";

describe("phone localization", () => {
  it("uses the registry packs as the only phone-copy source", () => {
    expect(PHONE_STRINGS.en).toBe(LOCALE_REGISTRY.en.phone);
    expect(PHONE_STRINGS.ko).toBe(LOCALE_REGISTRY.ko.phone);
  });

  it("keeps Korean and English dictionaries structurally identical", () => {
    expect(Object.keys(PHONE_STRINGS.ko).sort())
      .toEqual(Object.keys(PHONE_STRINGS.en).sort());
  });

  it("resolves System to registered browser locales", () => {
    expect(resolvePhoneLocale("system", "ko-KR")).toBe("ko");
    expect(resolvePhoneLocale("system", "en-US")).toBe("en");
    expect(resolvePhoneLocale("system", "ja-JP")).toBe("ja");
    expect(resolvePhoneLocale("system", "ar-SA")).toBe("ar");
    expect(resolvePhoneLocale("ko", "en-US")).toBe("ko");
  });

  it("reads strings from the selected dictionary", () => {
    expect(translatePhone("en", "dashboard")).toBe("Dashboard");
    expect(translatePhone("ko", "dashboard")).toBe("대시보드");
    expect(translatePhone("en", "liveHudPreview")).toBe("Live HUD preview");
    expect(translatePhone("ko", "developmentFallback")).toBe("개발용 서버 키");
    expect(translatePhone("ko", "refreshDropped")).toBe("버린 화면 갱신");
    expect(translatePhone("en", "routingMode")).toBe("Routing mode");
    expect(translatePhone("en", "refreshBusy")).toBe(
      "A refresh is already in progress.",
    );
  });
});
