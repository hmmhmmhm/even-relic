import { describe, expect, it } from "vitest";
import {
  PHONE_STRINGS,
  resolvePhoneLocale,
  translatePhone,
} from "./phone-i18n";

describe("phone localization", () => {
  it("keeps Korean and English dictionaries structurally identical", () => {
    expect(Object.keys(PHONE_STRINGS.ko).sort())
      .toEqual(Object.keys(PHONE_STRINGS.en).sort());
  });

  it("resolves System to Korean only for ko locales", () => {
    expect(resolvePhoneLocale("system", "ko-KR")).toBe("ko");
    expect(resolvePhoneLocale("system", "en-US")).toBe("en");
    expect(resolvePhoneLocale("system", "ja-JP")).toBe("en");
    expect(resolvePhoneLocale("ko", "en-US")).toBe("ko");
  });

  it("reads strings from the selected dictionary", () => {
    expect(translatePhone("en", "dashboard")).toBe("Dashboard");
    expect(translatePhone("ko", "dashboard")).toBe("대시보드");
    expect(translatePhone("en", "liveHudPreview")).toBe("Live HUD preview");
    expect(translatePhone("ko", "developmentFallback")).toBe("개발용 서버 키");
  });
});
