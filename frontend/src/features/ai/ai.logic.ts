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

type ChatScrollBox = { scrollHeight: number; scrollTop: number; clientHeight: number };

/** Khoảng cách tới cuối khung (px) vẫn coi là "đang ở cuối": tin mới tới thì tự cuộn theo. */
export const CHAT_NEAR_BOTTOM_PX = 80;

/** Người dùng đang ở gần cuối khung chat (chưa cuộn lên đọc tin cũ). Chưa có khung → coi như ở cuối. */
export function isNearChatBottom(chatWindow: ChatScrollBox | null, threshold = CHAT_NEAR_BOTTOM_PX) {
  if (!chatWindow) return true;
  return chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight <= threshold;
}

/**
 * Cuộn CHỈ khung danh sách tin nhắn xuống cuối (scrollTo của khung). Không dùng scrollIntoView: lệnh đó cuộn cả trang.
 * smooth = false khi vừa vào trang (nhảy thẳng tới tin mới nhất).
 */
export function scrollChatToBottom(chatWindow: { scrollHeight: number; scrollTo: (options: ScrollToOptions) => void } | null, smooth: boolean) {
  chatWindow?.scrollTo({ top: chatWindow.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

/**
 * Enter gửi câu hỏi; Shift+Enter xuống dòng. Bỏ qua Enter khi bộ gõ tiếng Việt (Telex/VNI qua IME) đang ghép chữ:
 * isComposing, hoặc keyCode 229 ở trình duyệt chưa báo isComposing.
 */
export function isSubmitEnter(event: { key: string; shiftKey: boolean; isComposing: boolean; keyCode?: number }) {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}

/** Cảnh báo trên tin của trợ lý khi câu trả lời nhắc tới thành phần người dùng đã khai báo dị ứng. */
export function allergyWarningText(terms: string[] | undefined) {
  if (!terms?.length) return null;
  return `Câu trả lời có nhắc tới ${terms.join(", ")} — bạn đã khai báo dị ứng. Đừng dùng gợi ý này nếu chưa kiểm tra kỹ.`;
}

export type ChatErrorKind = "unavailable" | "limit" | "other";

/** Phân loại lỗi gửi câu hỏi theo mã HTTP/code từ backend: 503 (chưa có key, OpenAI lỗi) → gợi ý tính năng không cần AI. */
export function chatErrorKind(status: number | undefined, code: unknown): ChatErrorKind {
  if (status === 503 || code === "AI_NOT_CONFIGURED" || code === "AI_UNAVAILABLE") return "unavailable";
  if (status === 429) return "limit";
  return "other";
}

export const AI_NOT_CONFIGURED_TEXT = "Trợ lý AI chưa được bật trên máy chủ nên chưa trả lời được câu hỏi.";
