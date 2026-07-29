import { DiagnosticConsole } from "../DiagnosticConsole";
import type { PhoneStringKey } from "../phone-i18n";

export function DeveloperScreen({
  status,
  t,
}: {
  readonly status: string;
  readonly t: (key: PhoneStringKey) => string;
}) {
  return (
    <div className="phone-detail-stack">
      <section className="phone-panel">
        <dl className="phone-data-list">
          <div><dt>{t("sdk")}</dt><dd>0.0.11</dd></div>
          <div><dt>{t("renderer")}</dt><dd>Canvas · 4 tiles</dd></div>
          <div><dt>{t("transport")}</dt><dd>{status}</dd></div>
        </dl>
      </section>
      <DiagnosticConsole />
    </div>
  );
}
