import type { ReactNode } from "react";

export function PhoneHeader({
  title,
  parentLabel,
  onBack,
  action,
}: {
  readonly title: string;
  readonly parentLabel: string;
  readonly onBack: () => void;
  readonly action?: ReactNode;
}) {
  return (
    <header className="phone-detail-header">
      <button
        type="button"
        className="phone-detail-header__breadcrumb"
        aria-label={`${parentLabel} / ${title}`}
        onClick={onBack}
      >
        <span className="phone-detail-header__parent">{parentLabel}</span>
        <span aria-hidden="true">/</span>
        <span className="phone-detail-header__title">{title}</span>
      </button>
      <h1 className="phone-visually-hidden">{title}</h1>
      <div className="phone-detail-header__action">{action}</div>
    </header>
  );
}
