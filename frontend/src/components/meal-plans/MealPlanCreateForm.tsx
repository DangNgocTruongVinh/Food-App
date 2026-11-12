import type { FormEvent } from "react";
import { generateMealPlanLabel } from "../../features/meal-plans/meal-plans.logic";
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
  /** "Tạo bằng AI (1–2 phút)": chạy nền; chỉ hiện khi backend đã cấu hình OpenAI. */
  onSubmitAI: () => void;
  aiBusy: boolean;
};

/**
 * Ngày bắt đầu + "Tạo thực đơn" (mặc định: thuật toán, có kết quả ngay) + lựa chọn phụ "Tạo bằng AI (1–2 phút)" chạy nền
 * (chỉ khi /api/ai/status xác nhận đã cấu hình OpenAI).
 */
export function MealPlanCreateForm(props: MealPlanCreateFormProps) {
  const { startDate, dateStatus, onStartDateChange, onSubmit, pending, aiAvailable, onSubmitAI, aiBusy } = props;
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
        <span className="td-create__buttons">
          <Button type="submit" variant="primary" busy={pending}>{generateMealPlanLabel(pending)}</Button>
          {aiAvailable && (
            <Button busy={aiBusy} disabled={pending} onClick={() => { if (!error) onSubmitAI(); }}>
              {aiBusy ? "AI đang tạo..." : "Tạo bằng AI (1–2 phút)"}
            </Button>
          )}
        </span>
        <p className="ui-small td-create__source">Cách tạo: thuật toán gợi ý, có kết quả ngay.</p>
      </div>
    </form>
  );
}
