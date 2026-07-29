import type { ReactNode } from "react";
import { PhoneIcon } from "../phone-icons";

export function PhoneHeader({
  title,
  backLabel,
  onBack,
  action,
}: {
  readonly title: string;
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly action?: ReactNode;
}) {
  return (
    <header className="phone-detail-header">
      <button
        type="button"
        className="phone-icon-button"
        aria-label={backLabel}
        onClick={onBack}
      >
        <PhoneIcon name="back" size={30} />
      </button>
      <h1>{title}</h1>
      <div className="phone-detail-header__action">{action}</div>
    </header>
  );
}
