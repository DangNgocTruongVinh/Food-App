import { useFoodCategoryNames } from "../../features/catalog/catalog.queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { getApiError } from "../../api/client";
import { suggestFoodNames, toPantryFormValues, type PantryFormValues } from "../../features/pantry/pantry.api";
import {
  initialPantryForm, isExpiryEstimated, pantryCategoryOptions, pantryDoneMessage, storageLabel, validatePantryForm,
} from "../../features/pantry/pantry.logic";
import { invalidatePantryQueries, pantryMutations } from "../../features/pantry/pantry.queries";
import { foodUnitLabel } from "../../utils/units";
import type { FoodUnit, PantryItem, StorageLocation } from "../../types";
import DateInput from "../DateInput";
import { PantryItemHistory } from "./PantryHistory";
import { Button, Dialog, ErrorState, Field, Combobox } from "../ui";
import { foodNameOption } from "../../features/pantry/pantry.logic";
import { useRemoteOptions } from "../../features/ui/useRemoteOptions";

type PantryItemDialogProps = {
  /** null: thêm mới. */
  item: PantryItem | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

const UNITS: Array<[FoodUnit, string]> = [["G", "gram"], ["KG", "kg"], ["ML", "ml"], ["L", "lít"], ["ITEM", "cái"], ["PACKAGE", "gói"]];
const STORAGES = Object.keys(storageLabel) as StorageLocation[];
const ADD_DESCRIPTION = "Nouri nhắc bạn khi thực phẩm sắp hết hạn hoặc xuống dưới mức tối thiểu.";
const MINIMUM_HINT = "Nouri báo khi số lượng xuống tới mức này. Để 0 nếu không cần.";
/** Ô số bị xóa trắng cho NaN: hiện ô trống, lỗi báo khi bấm lưu. */
const numberValue = (value: number) => (Number.isNaN(value) ? "" : value);

/** Hộp thoại Thêm/Sửa thực phẩm: đúng các trường của kho; lỗi hiện ngay dưới trường sau lần bấm lưu đầu tiên. */
export function PantryItemDialog({ item, onClose, onSaved }: PantryItemDialogProps) {
  const categories = useFoodCategoryNames();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<PantryFormValues>(() => (item ? toPantryFormValues(item) : initialPantryForm));
  const [expiryInvalid, setExpiryInvalid] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validatePantryForm(form, expiryInvalid) : {};
  const editing = Boolean(item);
  // Hạn ước tính (đã mua → kho) còn nguyên ngày cũ thì nhắc; sửa sang ngày khác thì lưu xong mất chữ này.
  const estimated = item && isExpiryEstimated(item) && form.expiryDate === toPantryFormValues(item).expiryDate;
  const expiryHint = estimated ? "Hạn ước tính theo nhóm thực phẩm. Sửa nếu bao bì ghi ngày khác." : "Để trống nếu không có hạn.";

  const onSuccess = () => {
    invalidatePantryQueries(queryClient);
    onSaved(pantryDoneMessage(item ? "update" : "create", form.name.trim()));
  };
  const create = useMutation({ ...pantryMutations.create(form), onSuccess });
  const change = useMutation({ ...pantryMutations.update(), onSuccess });
  const saveError = create.error ?? change.error;

  const update = <K extends keyof PantryFormValues>(key: K, value: PantryFormValues[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    // Hạn sử dụng trống = không có hạn (gửi null, kể cả khi sửa để xóa hạn cũ); nhập sai thì không lưu.
    if (Object.keys(validatePantryForm(form, expiryInvalid)).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    if (item) change.mutate({ id: item.id, form });
    else create.mutate();
  };

  // Gợi ý tên: kho của mình + nguyên liệu các món (kèm nhóm dị ứng), từ GET /api/suggestions/foods.
  const nameSuggestions = useRemoteOptions(["suggestions", "foods"], form.name, suggestFoodNames, foodNameOption);
  return (
    <Dialog
      title={editing ? "Sửa thực phẩm" : "Thêm thực phẩm"}
      description={item ? `Cập nhật số lượng, hạn sử dụng hoặc nơi cất “${item.name}”.` : ADD_DESCRIPTION}
      onClose={onClose}
      className="kho-dialog"
    >
      <form ref={formRef} className="kho-form" noValidate onSubmit={submit}>
        <Field label="Tên thực phẩm" error={errors.name} className="kho-form__wide">
          {(control) => (
            <Combobox
              {...control}
              autoFocus
              value={form.name}
              placeholder="Ví dụ: Ức gà"
              onValueChange={(value) => update("name", value)}
              options={nameSuggestions.options}
              loading={nameSuggestions.loading}
              onPick={(option) => update("name", option.label)}
            />
          )}
        </Field>
        <Field label="Nhóm">
          {(control) => (
            <select {...control} value={form.category} onChange={(event) => update("category", event.target.value)}>
              {pantryCategoryOptions(form.category, categories).map((category) => <option key={category}>{category}</option>)}
            </select>
          )}
        </Field>
        <Field label="Hạn sử dụng" error={errors.expiryDate} hint={errors.expiryDate ? undefined : expiryHint}>
          {({ className, ...control }) => (
            <DateInput
              {...control}
              className="ui-date"
              inputClassName={className}
              value={form.expiryDate}
              onChange={(expiryDate, status) => { update("expiryDate", expiryDate); setExpiryInvalid(status === "invalid"); }}
            />
          )}
        </Field>
        <Field label="Số lượng" error={errors.quantity}>
          {(control) => (
            <input
              {...control}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={numberValue(form.quantity)}
              onChange={(event) => update("quantity", event.target.valueAsNumber)}
            />
          )}
        </Field>
        <Field label="Đơn vị">
          {(control) => (
            <select {...control} value={form.unit} onChange={(event) => update("unit", event.target.value as FoodUnit)}>
              {UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Tồn kho tối thiểu" error={errors.minimumStock} hint={MINIMUM_HINT} className="kho-form__wide">
          {(control) => (
            <input
              {...control}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={numberValue(form.minimumStock)}
              onChange={(event) => update("minimumStock", event.target.valueAsNumber)}
            />
          )}
        </Field>
        <Field
          label={`Đơn giá (đ / ${foodUnitLabel[form.unit]}, không bắt buộc)`} error={errors.unitPrice} className="kho-form__wide"
          hint="Dùng để ước tính tiền lãng phí ở trang Báo cáo."
        >
          {(control) => (
            <input
              {...control}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={numberValue(form.unitPrice)}
              onChange={(event) => update("unitPrice", event.target.valueAsNumber)}
            />
          )}
        </Field>
        <fieldset className="kho-form__wide kho-segment">
          <legend className="ui-field__label">Nơi bảo quản</legend>
          <div className="kho-segment__options">
            {STORAGES.map((storage) => (
              <label key={storage} className="kho-segment__option">
                <input
                  type="radio"
                  name="storageLocation"
                  value={storage}
                  checked={form.storageLocation === storage}
                  onChange={() => update("storageLocation", storage)}
                />
                <span>{storageLabel[storage]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Ghi chú" error={errors.note} className="kho-form__wide">
          {(control) => (
            <textarea
              {...control}
              rows={2}
              value={form.note}
              placeholder="Ví dụ: đã rã đông một nửa"
              onChange={(event) => update("note", event.target.value)}
            />
          )}
        </Field>
        {item && (
          <div className="kho-form__wide">
            <PantryItemHistory itemId={item.id} itemName={item.name} />
          </div>
        )}
        {saveError && (
          <div className="kho-form__wide">
            <ErrorState message={`Chưa lưu được: ${getApiError(saveError)}`} />
          </div>
        )}
        <div className="kho-form__actions kho-form__wide">
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" busy={create.isPending || change.isPending}>{editing ? "Lưu thay đổi" : "Lưu vào kho"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
