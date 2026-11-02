import { Link } from "react-router-dom";
import { assistantDietLabel, chatHistoryTime } from "../../features/ai/ai.logic";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import type { ChatMessage, DashboardData, NutritionProfile } from "../../types";
import { Card } from "../ui";

type AssistantContextCardProps = {
  profile: NutritionProfile | null | undefined;
  dashboard: DashboardData | undefined;
};

const listOrNone = (items: string[] | undefined) => (items?.length ? items.join(", ") : "không có");

/**
 * Ngữ cảnh trợ lý thật sự nhận (backend /ai/chat, chat-context.ts): hồ sơ dinh dưỡng, thực phẩm còn trong kho và tóm tắt
 * thực đơn đang áp dụng (bữa hôm nay và 2 ngày tới). Ghi rõ để người dùng hiểu câu trả lời dựa trên gì.
 */
export function AssistantContextCard({ profile, dashboard }: AssistantContextCardProps) {
  const expiring = dashboard?.expiringItems.slice(0, 3).map((item) => item.name) ?? [];
  return (
    <Card as="section" className="as-card" aria-labelledby="as-context-title">
      <h2 id="as-context-title" className="as-card__title">Trợ lý dựa vào</h2>
      <dl className="as-context">
        <div className="as-context__item">
          <dt>Hồ sơ dinh dưỡng</dt>
          {profile ? (
            <dd>
              <span>
                {assistantDietLabel(profile.dietType)}
                {profile.dailyCalorieTarget ? `, ${formatNumber(profile.dailyCalorieTarget)} kcal mỗi ngày` : ""}
              </span>
              <span>Dị ứng: {listOrNone(profile.allergies)}</span>
              <span>Không thích: {listOrNone(profile.dislikedFoods)}</span>
            </dd>
          ) : (
            <dd>Chưa có hồ sơ, trợ lý trả lời chung chung. <Link className="ui-link" to="/profile">Tạo hồ sơ</Link></dd>
          )}
        </div>
        <div className="as-context__item">
          <dt>Kho thực phẩm</dt>
          <dd>
            <span>{dashboard ? `${formatNumber(dashboard.pantryCount)} thực phẩm` : "Đang tải..."}</span>
            {expiring.length > 0 && <span>Sắp hết hạn: {expiring.join(", ")}</span>}
          </dd>
        </div>
        <div className="as-context__item">
          <dt>Thực đơn</dt>
          {dashboard?.activePlan ? (
            <dd>
              <span>“{dashboard.activePlan.name}” đang áp dụng.</span>
              <span>
                Trợ lý xem các bữa hôm nay và 2 ngày tới (tên món, calo, đã ăn hay chưa); hôm nay có {dashboard.todayMeals.length} bữa.
              </span>
            </dd>
          ) : (
            <dd>{dashboard ? "Chưa có thực đơn đang áp dụng." : "Đang tải..."}</dd>
          )}
        </div>
      </dl>
    </Card>
  );
}

export function AssistantSuggestionsCard({ suggestions, onPick }: { suggestions: string[]; onPick: (text: string) => void }) {
  return (
    <Card as="section" variant="quiet" className="as-card" aria-labelledby="as-suggestions-title">
      <h2 id="as-suggestions-title" className="as-card__title">Gợi ý câu hỏi</h2>
      <ul className="as-prompts">
        {suggestions.map((text) => <li key={text}><button type="button" className="as-prompt" onClick={() => onPick(text)}>{text}</button></li>)}
      </ul>
    </Card>
  );
}

type AssistantHistoryCardProps = {
  items: ChatMessage[];
  expanded: boolean;
  hasMore: boolean;
  onToggle: () => void;
};

/** Câu hỏi gần đây (thời gian thật); "Xem tất cả" mở rộng toàn bộ lịch sử đã tải. */
export function AssistantHistoryCard({ items, expanded, hasMore, onToggle }: AssistantHistoryCardProps) {
  if (!items.length) return null;
  return (
    <Card as="section" className="as-card" aria-labelledby="as-history-title">
      <header className="as-card__header">
        <h2 id="as-history-title" className="as-card__title">Câu hỏi gần đây</h2>
        {hasMore && (
          <button type="button" className="ui-link as-card__more" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? "Thu gọn" : "Xem tất cả"}
          </button>
        )}
      </header>
      <ul className="as-history">
        {items.map((item) => (
          <li key={item.id}>
            <span className="as-history__text">{item.content}</span>
            <time className="as-history__time" dateTime={item.createdAt}>{chatHistoryTime(item.createdAt)}</time>
          </li>
        ))}
      </ul>
    </Card>
  );
}
