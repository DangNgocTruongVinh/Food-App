import { useFoodCategoryNames } from "../../features/catalog/catalog.queries";
import { CircleAlert } from "lucide-react";
import { FLAG_LABELS, isExpiryEstimated, targetText, warningText, type EditableLine, type LineErrors } from "../../features/pantry/receipt-scan.logic";
import { pantryCategoryOptions } from "../../features/pantry/pantry.logic";
import { cx } from "../../features/ui/ui.logic";
import type { FoodUnit } from "../../types";
import DateInput from "../DateInput";
import { Field, Tag } from "../ui";

const UNITS: Array<[FoodUnit, string]> = [["G", "gram"], ["KG", "kg"], ["ML", "ml"], ["L", "lít"], ["ITEM", "cái"], ["PACKAGE", "gói"]];
/** Ô số bị xóa trắng cho NaN: hiện ô trống, lỗi báo khi bấm lưu. */
const numberValue = (value: number) => (Number.isNaN(value) ? "" : value);

type ReceiptReviewRowProps = {
  line: EditableLine;
  index: number;
  errors: LineErrors;
  onChange: (patch: Partial<EditableLine>) => void;
  onExpiryStatus: (invalid: boolean) => void;
};

/** Một dòng trên màn duyệt: chọn/bỏ, sửa tên, số lượng, đơn vị, nhóm, hạn; nơi sẽ vào trong kho; cờ đọc chưa chắc; cảnh báo dị ứng. */
export function ReceiptReviewRow({ line, index, errors, onChange, onExpiryStatus }: ReceiptReviewRowProps) {
  const categories = useFoodCategoryNames();
  const estimated = isExpiryEstimated(line);
  const disabled = !line.include;
  return (
    <li className={cx("kho-scan-row", disabled && "is-off")}>
      <div className="kho-scan-row__head">
        <label className="kho-scan-row__check">
          <input type="checkbox" checked={line.include} onChange={(event) => onChange({ include: event.target.checked })} />
          <span>Dòng {index + 1}: thêm vào kho</span>
        </label>
        {line.restored && <Tag>Đã khôi phục</Tag>}
      </div>
      <p className="kho-scan-row__raw">Trên ảnh: {line.rawText}</p>

      {line.warnings.map((warning) => (
        <p key={`${warning.kind}-${warning.term}`} className="kho-scan-row__warn"><CircleAlert aria-hidden="true" />{warningText(warning)}</p>
      ))}

      <fieldset className="kho-scan-row__fields" disabled={disabled}>
        <legend className="ui-visually-hidden">Thông tin dòng {index + 1}</legend>
        <Field label="Tên thực phẩm" error={errors.name} className="kho-scan-row__name">
          {(control) => (
            <input {...control} autoComplete="off" value={line.name} onChange={(event) => onChange({ name: event.target.value })} />
          )}
        </Field>
        <Field label="Số lượng" error={errors.quantity}>
          {(control) => (
            <input {...control} type="number" inputMode="decimal" min="0" step="any" value={numberValue(line.quantity)}
              onChange={(event) => onChange({ quantity: event.target.valueAsNumber })} />
          )}
        </Field>
        <Field label="Đơn vị">
          {(control) => (
            <select {...control} value={line.unit} onChange={(event) => onChange({ unit: event.target.value as FoodUnit })}>
              {UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Nhóm" className="kho-scan-row__half">
          {(control) => (
            <select {...control} value={line.category} onChange={(event) => onChange({ category: event.target.value })}>
              {pantryCategoryOptions(line.category, categories).map((category) => <option key={category}>{category}</option>)}
            </select>
          )}
        </Field>
        <Field label="Hạn sử dụng" error={errors.expiryDate} className="kho-scan-row__half"
          hint={errors.expiryDate ? undefined : estimated ? "Ước tính theo nhóm. Sửa nếu bao bì ghi ngày khác." : "Để trống nếu không có hạn."}>
          {({ className, ...control }) => (
            <DateInput {...control} className="ui-date" inputClassName={className} value={line.expiryDate}
              onChange={(expiryDate, status) => { onChange({ expiryDate }); onExpiryStatus(status === "invalid"); }} />
          )}
        </Field>
      </fieldset>

      <div className="kho-scan-row__meta">
        {estimated && <Tag>Hạn ước tính</Tag>}
        {line.flags.map((flag) => <Tag key={flag} className="kho-scan-row__flag">{FLAG_LABELS[flag]}</Tag>)}
        <span>{targetText(line)}</span>
      </div>
    </li>
  );
}
