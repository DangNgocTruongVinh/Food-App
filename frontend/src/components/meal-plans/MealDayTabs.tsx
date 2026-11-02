import { type KeyboardEvent, useRef } from "react";
import { planDayLabels } from "../../features/meal-plans/meal-plans.logic";
import { cx } from "../../features/ui/ui.logic";
import type { MealPlanDay } from "../../types";

type MealDayTabsProps = {
  days: MealPlanDay[];
  selectedIndex: number;
  todayIndex: number;
  panelId: string;
  onSelect: (index: number) => void;
};

export const dayTabId = (index: number) => `td-day-tab-${index}`;

/** Thanh 7 ngày (tablist): mũi tên trái/phải, Home/End đổi ngày; chỉ ngày đang chọn nhận Tab. Hôm nay có nhãn riêng. */
export function MealDayTabs({ days, selectedIndex, todayIndex, panelId, onSelect }: MealDayTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const move = (index: number) => {
    const next = (index + days.length) % days.length;
    onSelect(next);
    listRef.current?.querySelector<HTMLButtonElement>(`#${dayTabId(next)}`)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = { ArrowRight: selectedIndex + 1, ArrowLeft: selectedIndex - 1, Home: 0, End: days.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    move(keys[event.key]);
  };

  return (
    <div ref={listRef} className="td-days" role="tablist" aria-label="Chọn ngày trong thực đơn">
      {days.map((day, index) => {
        const labels = planDayLabels(day);
        const selected = index === selectedIndex;
        const today = index === todayIndex;
        return (
          <button
            key={day.id}
            id={dayTabId(index)}
            type="button"
            role="tab"
            className={cx("td-day", today && "td-day--today")}
            aria-selected={selected}
            aria-controls={panelId}
            aria-label={`${labels.weekday} ${labels.date}${today ? ", hôm nay" : ""}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(index)}
            onKeyDown={onKeyDown}
          >
            <span className="td-day__name">
              {today ? <><span className="td-day__wide">Hôm nay</span><span className="td-day__narrow">{labels.short}</span></> : labels.short}
            </span>
            <span className="td-day__date">{labels.date}</span>
          </button>
        );
      })}
    </div>
  );
}
