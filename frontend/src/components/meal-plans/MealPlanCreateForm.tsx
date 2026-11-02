import type { FormEvent } from "react";
import { generateMealPlanLabel, generateSourceLabel } from "../../features/meal-plans/meal-plans.logic";
import type { DateDraftStatus } from "../../utils/date";
import DateInput from "../DateInput";
import { Button, Field } from "../ui";

type MealPlanCreateFormProps = {
  startDate: string;
  dateStatus: DateDraftStatus;
  onStartDateChange: (value: string, status: DateDraftStatus) => void;
  onSubmit: () => void;
  pending: boolean;
  aiAvailable: boolean | undefined;
};

/** Ngày bắt đầu + "Tạo thực đơn"; ghi rõ cách tạo theo /api/ai/status (AI chỉ khi backend xác nhận đã cấu hình). */
export function MealPlanCreateForm({ startDate, dateStatus, onStartDateChange, onSubmit, pending, aiAvailable }: MealPlanCreateFormProps) {
  const error = dateStatus === "invalid" ? "Nhập ngày theo dạng dd/mm/yyyy." : dateStatus === "empty" && !startDate ? "Chọn ngày bắt đầu thực đơn." : undefined;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!error) onSubmit();
  };
  return (
    <form className="td-create" noValidate onSubmit={submit} aria-label="Tạo thực đơn mới">
      <Field label="Ngày bắt đầu" error={error} className="td-create__date">
        {({ className, ...control }) => (
          <DateInput {...control} className="ui-date" inputClassName={className} value={startDate} onChange={onStartDateChange} />
        )}
      </Field>
      <div className="td-create__action">
        <Button type="submit" variant="primary" busy={pending}>{generateMealPlanLabel(pending)}</Button>
        <p className="ui-small td-create__source">Cách tạo: {generateSourceLabel(aiAvailable)}</p>
      </div>
    </form>
  );
}
