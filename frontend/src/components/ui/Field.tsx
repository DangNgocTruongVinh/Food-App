import { type InputHTMLAttributes, type ReactNode, useId } from "react";
import { cx, fieldIds } from "../../features/ui/ui.logic";

/** Thuộc tính gắn vào ô nhập để liên kết nhãn, gợi ý và lỗi. */
export type FieldControlProps = {
  id: string;
  className: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "children"> & {
  label: string;
  hint?: ReactNode;
  /** Nói rõ cách sửa ("Nhập số lớn hơn 0"). */
  error?: ReactNode;
  /** Dùng khi ô nhập không phải <input> (select, textarea, DateInput): nhận thuộc tính liên kết và tự vẽ ô. */
  children?: (control: FieldControlProps) => ReactNode;
};

/** Ô nhập có nhãn ở trên; lỗi hiện ngay dưới ô (aria-describedby), gợi ý sau cùng. */
export function Field({ id, label, hint, error, children, className, ...inputProps }: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const ids = fieldIds(fieldId, { hint, error });
  const control: FieldControlProps = {
    id: fieldId,
    className: "ui-input",
    "aria-describedby": ids.describedBy,
    ...(ids.invalid ? { "aria-invalid": true as const } : {}),
  };
  return (
    <div className={cx("ui-field", className)}>
      <label className="ui-field__label" htmlFor={fieldId}>{label}</label>
      {children ? children(control) : <input {...inputProps} {...control} />}
      {error && <p id={ids.errorId} className="ui-field__error">{error}</p>}
      {hint && <p id={ids.hintId} className="ui-field__hint">{hint}</p>}
    </div>
  );
}
