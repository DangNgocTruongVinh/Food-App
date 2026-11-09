import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addablePlans, planDayOptions } from "../../features/meal-plans/add-meal.logic";
import { initialDayIndex, mealPlanPath } from "../../features/meal-plans/meal-plans.logic";
import { mealPlanQueries } from "../../features/meal-plans/meal-plans.queries";
import type { MealType, Recipe } from "../../types";
import { Button, ButtonLink, Dialog, EmptyState, ErrorState, LoadingState, Skeleton } from "../ui";
import { MealSlotFields } from "./MealSlotFields";

export type AddToPlanInput = { planId: string; dayId: string; mealType: MealType; servings: number };

type AddToPlanDialogProps = {
  recipe: Pick<Recipe, "name" | "mealTypes">;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: AddToPlanInput) => void;
};

/** "Thêm vào thực đơn" ở chi tiết công thức: chọn thực đơn chưa hoàn tất, ngày, bữa, khẩu phần. */
export function AddToPlanDialog({ recipe, busy, error, onClose, onSubmit }: AddToPlanDialogProps) {
  const plansQuery = useQuery(mealPlanQueries.list());
  const plans = useMemo(() => addablePlans(plansQuery.data ?? []), [plansQuery.data]);
  const [planChoice, setPlanChoice] = useState("");
  const [dayChoice, setDayChoice] = useState("");
  const [mealType, setMealType] = useState<MealType>(recipe.mealTypes?.[0] ?? "LUNCH");
  const [servings, setServings] = useState("1");

  const plan = plans.find((item) => item.id === planChoice) ?? plans[0];
  const days = planDayOptions(plan);
  // Ngày mặc định: hôm nay nếu thuộc thực đơn, không thì ngày đầu; đổi thực đơn thì chọn lại theo thực đơn mới.
  const dayId = days.some((day) => day.value === dayChoice) ? dayChoice : plan?.days[initialDayIndex(plan)]?.id ?? "";
  const save = () => {
    if (plan && dayId) onSubmit({ planId: plan.id, dayId, mealType, servings: Number(servings) });
  };

  return (
    <Dialog title={`Thêm “${recipe.name}” vào thực đơn`} onClose={onClose} className="td-add-meal">
      {plansQuery.isLoading ? (
        <LoadingState label="Đang tải thực đơn"><Skeleton kind="block" height={64} /></LoadingState>
      ) : plansQuery.isError ? (
        <ErrorState message="Chưa tải được thực đơn." onRetry={() => void plansQuery.refetch()} retrying={plansQuery.isFetching} />
      ) : !plan ? (
        <EmptyState
          message="Bạn chưa có thực đơn nào còn thêm món được. Tạo thực đơn ở trang Thực đơn trước."
          action={<ButtonLink to={mealPlanPath()}>Mở trang Thực đơn</ButtonLink>}
        />
      ) : (
        <>
          <div className="td-add-meal__portion">
            <label htmlFor="add-to-plan-plan">Thực đơn</label>
            <select id="add-to-plan-plan" className="ui-input" value={plan.id} disabled={busy} onChange={(event) => setPlanChoice(event.target.value)}>
              {plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label htmlFor="add-to-plan-day">Ngày</label>
            <select id="add-to-plan-day" className="ui-input" value={dayId} disabled={busy} onChange={(event) => setDayChoice(event.target.value)}>
              {days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </div>
          <MealSlotFields
            idPrefix="add-to-plan"
            mealType={mealType}
            servings={servings}
            disabled={busy}
            onMealTypeChange={setMealType}
            onServingsChange={setServings}
          />
        </>
      )}
      {error && <p className="ui-notice ui-notice--error" role="alert">Chưa thêm được món: {error}</p>}
      <div className="ui-dialog__actions">
        <Button onClick={onClose} disabled={busy}>Hủy</Button>
        <Button variant="primary" busy={busy} disabled={!plan || !dayId} onClick={save}>Thêm vào thực đơn</Button>
      </div>
    </Dialog>
  );
}
