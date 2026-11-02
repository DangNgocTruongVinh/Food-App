import { differenceInCalendarDays, format } from "date-fns";
import type { ChatMessage, DashboardData, NutritionProfile } from "../../types";

const dietLabels: Record<string, string> = {
  BALANCED: "Ăn cân bằng",
  VEGETARIAN: "Ăn chay",
  VEGAN: "Thuần chay",
  LOW_CARB: "Ít tinh bột",
  HIGH_PROTEIN: "Giàu đạm",
};

export function assistantDietLabel(dietType?: string) {
  return dietLabels[dietType ?? ""] ?? "Chưa chọn";
}

export const RECENT_HISTORY_LIMIT = 4;

// Câu hỏi của người dùng, mới nhất trước; limit = null để lấy toàn bộ lịch sử đã tải.
export function recentUserHistory(messages: ChatMessage[], limit: number | null = RECENT_HISTORY_LIMIT) {
  const questions = messages.filter((item) => item.role === "user").reverse();
  return limit === null ? questions : questions.slice(0, limit);
}

export function chatHistoryTime(createdAt: string, now = new Date()) {
  const date = new Date(createdAt);
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return format(date, "HH:mm");
  if (days === 1) return "Hôm qua";
  return `${days} ngày trước`;
}

/** Thời gian dưới mỗi tin nhắn (createdAt thật): hôm nay chỉ ghi giờ, ngày khác ghi kèm ngày. */
export function chatMessageTime(createdAt: string, now = new Date()) {
  const date = new Date(createdAt);
  return differenceInCalendarDays(now, date) <= 0 ? format(date, "HH:mm") : format(date, "HH:mm, dd/MM/yyyy");
}

export function normalizeChatMessage(message: string) {
  const normalized = message.trim();
  return normalized || null;
}

type AssistantContextInput = {
  profile: NutritionProfile | null | undefined;
  dashboard: Pick<DashboardData, "expiringItems" | "pantryCount" | "nutritionTargets"> | undefined;
};

/**
 * Câu hỏi gợi ý dựa trên dữ liệu thật: món sắp hết hạn trong kho, chỉ tiêu đạm, chế độ ăn, dị ứng.
 * Thiếu dữ liệu thì dùng câu hỏi chung (không bịa tên món hay con số). Tối đa 4 câu.
 */
export function assistantPromptSuggestions({ profile, dashboard }: AssistantContextInput, now = new Date()) {
  const prompts: string[] = [];
  const expiring = dashboard?.expiringItems?.[0];
  if (expiring) {
    const days = expiring.expiryDate ? differenceInCalendarDays(new Date(expiring.expiryDate), now) : null;
    const when = days === null ? "" : days <= 0 ? " (hết hạn hôm nay)" : ` (còn ${days} ngày)`;
    prompts.push(`Nấu gì với ${expiring.name.toLocaleLowerCase("vi")}${when} cho bữa tối nay?`);
  }
  const protein = profile?.proteinTargetG ?? dashboard?.nutritionTargets?.proteinG;
  if (protein) prompts.push(`Làm sao ăn đủ ${protein} g đạm hôm nay?`);
  if (profile?.dietType === "VEGETARIAN" || profile?.dietType === "VEGAN") {
    prompts.push(`Bữa sáng ${profile.dietType === "VEGAN" ? "thuần chay" : "chay"} nào đủ no trong 15 phút?`);
  }
  const allergy = profile?.allergies?.find((item) => item.trim());
  if (allergy) prompts.push(`Món nào thay thế được khi tôi dị ứng ${allergy.trim().toLocaleLowerCase("vi")}?`);
  if (dashboard?.pantryCount) prompts.push("Từ những gì đang có trong kho, tôi nấu được món nào?");
  const generic = ["Bữa tối dưới 500 kcal nên ăn gì?", "Gợi ý bữa sáng nhanh, nhiều đạm."];
  return [...prompts, ...generic].slice(0, 4);
}

type ChatScrollContainer = { scrollHeight: number; scrollTo: (options: ScrollToOptions) => void };
type ChatScrollMarker = { scrollIntoView: (options: ScrollIntoViewOptions) => void };

/**
 * Cuộn tới tin nhắn mới nhất. Luôn cuộn bên trong khung chat; chỉ kéo cả trang sau khi người dùng đã gửi tin,
 * để khi vừa vào trang tiêu đề không bị đẩy lên sau thanh menu cố định.
 */
export function scrollChatToLatest(chatWindow: ChatScrollContainer | null, latest: ChatScrollMarker | null, userHasSent: boolean) {
  chatWindow?.scrollTo({ top: chatWindow.scrollHeight, behavior: userHasSent ? "smooth" : "auto" });
  if (userHasSent) latest?.scrollIntoView({ behavior: "smooth" });
}
