import type { ChatMessage } from "../../types";

export const assistantSuggestions = [
  "Gợi ý bữa tối từ thực phẩm sắp hết hạn",
  "Làm sao để đạt đủ protein hôm nay?",
  "Tôi nên chuẩn bị gì cho bữa sáng nhanh?",
];

export const assistantQuickActions = [
  { id: "meal", title: "Gợi ý bữa ăn", copy: "Theo mục tiêu dinh dưỡng của bạn", prompt: "Gợi ý bữa ăn phù hợp với mục tiêu dinh dưỡng hôm nay", tone: "meal" },
  { id: "plan", title: "Lập thực đơn", copy: "Kế hoạch 1–7 ngày phù hợp thể trạng", prompt: "Hãy lập cho tôi một thực đơn lành mạnh trong 7 ngày", tone: "plan" },
  { id: "pantry", title: "Nấu từ thực phẩm trong kho", copy: "Tận dụng nguyên liệu sẵn có", prompt: "Gợi ý món ăn từ thực phẩm hiện có trong kho của tôi", tone: "pantry" },
  { id: "recipe", title: "Gợi ý công thức", copy: "Món ngon, lành mạnh và dễ làm", prompt: "Gợi ý cho tôi một công thức lành mạnh và dễ làm", tone: "recipe" },
] as const;

export const assistantPromptPills = ["Món dưới 30 phút", "Món ít calo", "Tăng cơ, nhiều protein", "Ăn chay", "Giảm cân"];
export const assistantFallbackHistory = ["Gợi ý bữa tối giàu protein", "Thực đơn giảm cân 3 ngày", "Dùng thực phẩm trong kho", "Giá trị dinh dưỡng của ức gà"];

const dietLabels: Record<string, string> = {
  BALANCED: "Ăn cân bằng",
  VEGETARIAN: "Ăn chay",
  VEGAN: "Thuần chay",
  LOW_CARB: "Low Carb",
  HIGH_PROTEIN: "Giàu protein",
};

export function assistantDietLabel(dietType?: string) {
  return dietLabels[dietType ?? ""] ?? "Ăn lành mạnh";
}

export function recentUserHistory(messages: ChatMessage[]) {
  return messages.filter((item) => item.role === "user").slice(-4).reverse().map((item) => item.content);
}

export function normalizeChatMessage(message: string) {
  const normalized = message.trim();
  return normalized || null;
}
