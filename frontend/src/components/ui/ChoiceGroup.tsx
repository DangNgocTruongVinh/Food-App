import { useId } from "react";
import { cx } from "../../features/ui/ui.logic";

type ChoiceGroupProps = {
  legend: string;
  name: string;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  className?: string;
};

/** Nhóm radio dạng nút viên (chọn một): fieldset + legend, mũi tên đổi lựa chọn như radio gốc; lỗi/gợi ý liên kết aria-describedby. */
export function ChoiceGroup({ legend, name, options, value, onChange, hint, error, className }: ChoiceGroupProps) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset className={cx("ui-choice", className)} aria-describedby={describedBy}>
      <legend className="ui-field__label">{legend}</legend>
      <div className="ui-choice__options">
        {options.map(([optionValue, label]) => (
          <label key={optionValue} className="ui-choice__option">
            <input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={() => onChange(optionValue)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {error && <p id={`${id}-error`} className="ui-field__error">{error}</p>}
      {hint && <p id={`${id}-hint`} className="ui-field__hint">{hint}</p>}
    </fieldset>
  );
}
