import type { FastCanvasBattery } from "../glasses";
import { EVEN_HUB_SDK_VERSION } from "../app-metadata";
import type { PhoneStringKey } from "../phone-i18n";

function batteryText(
  battery: FastCanvasBattery | undefined,
  unavailable: string,
  charging: string,
): string {
  if (!battery || battery.level === undefined) return unavailable;
  return `${battery.level}%${battery.charging ? ` · ${charging}` : ""}`;
}

export function DevicesScreen({
  battery,
  status,
  t,
}: {
  readonly battery?: FastCanvasBattery;
  readonly status: string;
  readonly t: (key: PhoneStringKey) => string;
}) {
  const g2 = battery?.label === "G2" ? battery : undefined;
  const ring = battery?.label === "R1" ? battery : undefined;
  return (
    <div className="phone-detail-stack">
      <section className="phone-panel">
        <h2>{t("deviceStatus")}</h2>
        <dl className="phone-data-list">
          <div>
            <dt>{t("glasses")}</dt>
            <dd>{g2 ? t("connected") : t("unavailable")}</dd>
          </div>
          <div>
            <dt>{t("battery")}</dt>
            <dd>{batteryText(g2, t("unavailable"), t("charging"))}</dd>
          </div>
          <div>
            <dt>{t("ring")}</dt>
            <dd>{ring ? t("connected") : t("unavailable")}</dd>
          </div>
          <div>
            <dt>{t("battery")}</dt>
            <dd>{batteryText(ring, t("unavailable"), t("charging"))}</dd>
          </div>
        </dl>
      </section>
      <section className="phone-panel">
        <dl className="phone-data-list">
          <div><dt>{t("sdk")}</dt><dd>{EVEN_HUB_SDK_VERSION}</dd></div>
          <div><dt>{t("bilateral")}</dt><dd>{t("active")}</dd></div>
          <div><dt>{t("transport")}</dt><dd>{status}</dd></div>
        </dl>
      </section>
    </div>
  );
}
