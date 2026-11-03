/** Bộ 8 nhóm thực phẩm dùng chung cho Kho và danh sách đi chợ (cùng thứ tự với backend `services/food-category.ts`). */
export const FOOD_CATEGORIES = ["Rau củ", "Thịt & cá", "Trứng & sữa", "Đậu & hạt", "Ngũ cốc", "Trái cây", "Gia vị", "Khác"] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];
