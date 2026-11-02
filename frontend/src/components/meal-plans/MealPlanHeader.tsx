import type { ReactNode } from "react";
import { mealPlanSourceLabel, mealPlanStatusLabels, planTitleParts } from "../../features/meal-plans/meal-plans.logic";
import type { MealPlan } from "../../types";
import { formatDayMonth, formatDisplayDate } from "../../utils/date";
import { Button, Tag } from "../ui";

type MealPlanHeaderProps = {
  plan: MealPlan;
  plans: MealPlan[];
  onSelectPlan: (id: string) => void;
  onActivate: () => void;
  activating: boolean;
  onDelete: () => void;
  deleting: boolean;
  /** Ô tạo thực đơn mới (đặt bên phải tiêu đề). */
  createForm: ReactNode;
};

/** Đầu trang: H1 tên thực đơn, trạng thái, nguồn, khoảng ngày; chọn thực đơn, áp dụng, xóa; tạo thực đơn mới. */
export function MealPlanHeader({ plan, plans, onSelectPlan, onActivate, activating, onDelete, deleting, createForm }: MealPlanHeaderProps) {
  const title = planTitleParts(plan.name);
  return (
    <header className="td-hero">
      <div className="td-hero__main">
        <div className="td-hero__text">
          <h1 className="ui-title">{title.emphasis ? `${title.lead} ${title.emphasis}` : title.lead}</h1>
          <ul className="td-hero__meta" aria-label="Thông tin thực đơn">
            <li><Tag className={plan.status === "ACTIVE" ? "td-tag--active" : undefined}>{mealPlanStatusLabels[plan.status]}</Tag></li>
            <li><Tag>{mealPlanSourceLabel(plan.aiGenerated)}</Tag></li>
            <li className="td-hero__dates">{formatDayMonth(plan.startDate)} – {formatDisplayDate(plan.endDate)}</li>
          </ul>
        </div>
        {createForm}
      </div>
      <div className="td-toolbar">
        <div className="td-toolbar__field">
          <label className="td-toolbar__label" htmlFor="td-plan-select">Thực đơn đang xem</label>
          <select id="td-plan-select" className="ui-input td-toolbar__select" value={plan.id} onChange={(event) => onSelectPlan(event.target.value)}>
            {plans.map((item) => (
              <option key={item.id} value={item.id}>{item.name}{item.status === "ACTIVE" ? " (đang áp dụng)" : ""}</option>
            ))}
          </select>
        </div>
        <div className="td-toolbar__actions">
          {plan.status === "DRAFT" && <Button busy={activating} onClick={onActivate}>Áp dụng thực đơn</Button>}
          <Button variant="danger" busy={deleting} onClick={onDelete}>Xóa thực đơn</Button>
        </div>
      </div>
    </header>
  );
}
