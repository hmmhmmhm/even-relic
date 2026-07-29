import type { PhoneLocaleSetting } from "../phone-types";
import type { PhoneStringKey } from "../phone-i18n";

export function LanguageScreen({
  value,
  t,
  onChange,
}: {
  readonly value: PhoneLocaleSetting;
  readonly t: (key: PhoneStringKey) => string;
  readonly onChange: (value: PhoneLocaleSetting) => void;
}) {
  const choices = [
    ["system", t("system")],
    ["ko", t("korean")],
    ["en", t("english")],
  ] as const;
  return (
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
            onChange={() => onChange(choice)}
          />
        </label>
      ))}
    </fieldset>
  );
}
