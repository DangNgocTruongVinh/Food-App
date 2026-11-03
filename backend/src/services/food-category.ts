import { normalizeFoodText } from "./dietary.service.js";

// Bộ 8 nhóm thực phẩm dùng chung cho Kho và danh sách đi chợ (GĐ3b, quyết định 4). "Ngũ cốc" gồm gạo, bún, bánh.
export const FOOD_CATEGORIES = ["Rau củ", "Thịt & cá", "Trứng & sữa", "Đậu & hạt", "Ngũ cốc", "Trái cây", "Gia vị", "Khác"] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

// Xét theo từ đầu tên nguyên liệu, theo thứ tự: ngoại lệ trước ("đậu bắp", "đậu hà lan" là rau; "cà" khác "cá").
// Chuyển từ frontend (trước đây chỉ để trình bày) về đây để danh sách đi chợ và "đã mua → kho" dùng chung một nguồn.
const RULES: Array<[FoodCategory, RegExp]> = [
  ["Rau củ", /^(đậu bắp|đậu hà lan|đậu que|bắp ngọt|đu đủ xanh|ớt chuông)/],
  ["Gia vị", /^(muối|đường|tiêu|nước mắm|nước tương|tương|giấm|dầu|mật ong|quế|hoa hồi|lá oregano|mè|hạt nêm|bột ngọt|ô liu)/],
  ["Thịt & cá", /^(thịt|sườn|xương|đùi gà|ức gà|cánh gà|gà|bò|heo|cá|tôm|mực|cua|nghêu)/],
  ["Trứng & sữa", /^(trứng|sữa|phô mai|bơ lạt)/],
  ["Đậu & hạt", /^(đậu|hạt|lạc)/],
  ["Ngũ cốc", /^(gạo|nếp|bún|bánh|mì|miến|yến mạch|bột)/],
  ["Trái cây", /^(chuối|chanh|thơm|dứa|quả|táo|cam|xoài|nước dừa|nước cốt dừa|dừa|me)/],
  ["Rau củ", /^(rau|cải|cà|bí|hành|tỏi|gừng|sả|ớt|nấm|giá|xà lách|dưa|khoai|bông cải|hẹ|ngò|bạc hà|lá|su|măng|đu đủ)/],
];

const key = (name: string) => normalizeFoodText(name.normalize("NFC"));

/** Nhóm của một nguyên liệu/thực phẩm theo tên; không khớp quy tắc nào thì "Khác". */
export function foodCategoryOf(name: string): FoodCategory {
  const text = key(name);
  return RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? "Khác";
}

// "Đậu & hạt" gồm hai loại bảo quản rất khác nhau (dùng cho hạn gợi ý khi "đã mua → kho", GĐ3b lượt 6):
// hạt khô (đậu phộng, mè, đậu xanh/đen/đỏ/nành khô, các loại hạt) để lâu ở nơi khô ráo; đậu hũ, đậu tươi để ngăn mát vài ngày.
const DRY_LEGUMES = /^(đậu (phộng|xanh|đen|đỏ|nành|trắng|gà|lăng)|lạc|hạt|mè|vừng)/;

/** Chỉ có nghĩa với nhóm "Đậu & hạt": "dry" = hạt khô, "fresh" = đậu hũ/đậu tươi (mặc định khi không chắc: hạn ngắn hơn, an toàn hơn). */
export function legumeKind(name: string): "dry" | "fresh" {
  return DRY_LEGUMES.test(key(name)) ? "dry" : "fresh";
}

// "Ngũ cốc" cũng có hai loại: đồ khô (gạo, nếp, mì/bún/phở khô, mì gói, miến, nui, yến mạch, bột, bánh tráng) để lâu ở nơi
// khô ráo; đồ tươi (bánh mì, bún tươi, bánh phở, bánh cuốn, mì tươi…) chỉ vài ngày. Tên có chữ "khô" luôn là đồ khô.
const DRY_GRAINS = /^(gạo|nếp|yến mạch|bột|miến|nui|mì ý|mì gói|mì tôm|bánh tráng|ngũ cốc)|(^| )khô( |$)/;

/** Chỉ có nghĩa với nhóm "Ngũ cốc": "dry" = đồ khô, "fresh" = đồ tươi (mặc định khi không chắc: hạn ngắn hơn, an toàn hơn). */
export function grainKind(name: string): "dry" | "fresh" {
  return DRY_GRAINS.test(key(name)) ? "dry" : "fresh";
}

/** Dòng đi chợ cũ (tạo trước GĐ3b lượt 5) chưa có `category`: tính khi đọc, không cần migration dữ liệu. */
export function withFoodCategory<T extends { name: string; category: string | null }>(item: T): T & { category: string } {
  return { ...item, category: item.category?.trim() || foodCategoryOf(item.name) };
}
