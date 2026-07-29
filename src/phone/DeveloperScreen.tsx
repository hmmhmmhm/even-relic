import { DiagnosticConsole } from "../DiagnosticConsole";
import { EVEN_HUB_SDK_VERSION } from "../app-metadata";
import type { PhoneStringKey } from "../phone-i18n";
import type { RssSource } from "../rss-sources";

export function DeveloperScreen({
  status,
  routingEnabled,
  rssSources,
  t,
}: {
  readonly status: string;
  readonly routingEnabled: boolean;
  readonly rssSources: readonly RssSource[];
  readonly t: (key: PhoneStringKey) => string;
}) {
  const enabledRssSources = rssSources.filter((source) => source.enabled).length;
  return (
    <div className="phone-detail-stack">
      <section className="phone-panel">
        <dl className="phone-data-list">
          <div><dt>{t("sdk")}</dt><dd>{EVEN_HUB_SDK_VERSION}</dd></div>
          <div><dt>{t("renderer")}</dt><dd>Canvas · 4 tiles</dd></div>
          <div><dt>{t("transport")}</dt><dd>{status}</dd></div>
          <div>
            <dt>{t("routingMode")}</dt>
            <dd>{routingEnabled ? t("configured") : t("notConfigured")}</dd>
          </div>
          <div>
            <dt>{t("rssSources")}</dt>
            <dd>{enabledRssSources} {t("enabled").toLowerCase()}</dd>
          </div>
        </dl>
      </section>
      <DiagnosticConsole
        labels={{
          region: t("webviewTraceRegion"),
          title: t("webviewTrace"),
          logDropped: t("logDropped"),
          refreshDropped: t("refreshDropped"),
          copy: t("copy"),
          copied: t("copied"),
          copyFailed: t("copyFailed"),
          clear: t("clear"),
        }}
      />
    </div>
  );
}
