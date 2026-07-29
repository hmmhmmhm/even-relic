import { useState } from "react";
import type { PhoneLocaleSetting } from "../phone-types";
import type { PhoneStringKey } from "../phone-i18n";

export function LanguageScreen({
  value,
  t,
  onChange,
}: {
  readonly value: PhoneLocaleSetting;
  readonly t: (key: PhoneStringKey) => string;
  readonly onChange: (
    value: PhoneLocaleSetting,
  ) => boolean | Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const choices = [
    ["system", t("system")],
    ["ko", t("korean")],
    ["en", t("english")],
  ] as const;
  const choose = async (choice: PhoneLocaleSetting) => {
    if (saving || choice === value) return;
    setSaving(true);
    const saved = await onChange(choice);
    setError(saved ? undefined : t("storageFailed"));
    setSaving(false);
  };
  return (
    <div className="phone-detail-stack">
      <fieldset className="phone-panel phone-choice-list">
        <legend className="phone-visually-hidden">{t("language")}</legend>
        {choices.map(([choice, label]) => (
          <label key={choice}>
            <span>{label}</span>
            <input
              type="radio"
              name="phone-language"
              value={choice}
              checked={value === choice}
              disabled={saving}
              onChange={() => void choose(choice)}
            />
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
    </div>
  );
}
