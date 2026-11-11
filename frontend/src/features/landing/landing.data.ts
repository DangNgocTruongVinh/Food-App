/** Nội dung tĩnh của Landing (chữ mô tả chức năng có thật; số liệu lấy từ API, không đặt ở đây). */

export const LANDING_SECTIONS = [
  { id: "nouri-giup-gi", label: "Tính năng" },
  { id: "mon-an", label: "Món ăn" },
  { id: "cach-hoat-dong", label: "Cách hoạt động" },
  { id: "cong-dong", label: "Cộng đồng" },
] as const;

/**
 * Năm chức năng chính, mỗi chức năng một trang thật (`path`). Kho đứng đầu và lớn hơn vì là việc làm hằng ngày.
 * `icon`: tên icon lucide (component chọn icon theo khóa này).
 */
export const LANDING_FEATURES = [
  {
    key: "pantry", icon: "pantry", path: "/pantry", action: "Mở kho thực phẩm",
    title: "Biết trong tủ còn gì",
    body: "Mỗi thực phẩm có số lượng, hạn sử dụng và nơi bảo quản. Nouri báo khi một món còn 3 ngày là hết hạn, "
      + "và khi số lượng xuống dưới mức bạn đặt.",
    extra: "Đi chợ về, chụp hóa đơn để thêm nhiều thực phẩm một lượt; bạn xem lại từng dòng trước khi lưu.",
  },
  {
    key: "meal-plans", icon: "plan", path: "/meal-plans", action: "Mở thực đơn",
    title: "Thực đơn 7 ngày theo hồ sơ",
    body: "Calo, đạm, tinh bột, béo tính từ hồ sơ của bạn; món có thành phần bạn dị ứng bị loại. Kèm danh sách đi chợ chỉ gồm phần còn thiếu.",
    extra: null,
  },
  {
    key: "recipes", icon: "recipes", path: "/recipes", action: "Xem công thức",
    title: "Công thức nấu ở nhà",
    body: "Nguyên liệu, các bước làm và dinh dưỡng cho một khẩu phần. Mục \"Dành cho bạn\" gợi ý món hợp hồ sơ và đồ đang có trong kho.",
    extra: null,
  },
  {
    key: "community", icon: "community", path: "/community", action: "Mở Cộng đồng",
    title: "Cộng đồng bếp nhà",
    body: "Đăng món vừa nấu kèm ảnh và công thức trong Nouri; thích, bình luận và nhận thông báo khi bài của bạn có tương tác.",
    extra: null,
  },
  {
    key: "assistant", icon: "assistant", path: "/assistant", action: "Hỏi Trợ lý AI",
    title: "Trợ lý AI",
    body: "Hỏi nhanh nên nấu gì, thay nguyên liệu ra sao. Trợ lý dựa trên hồ sơ, kho và thực đơn đang dùng của bạn, và tránh món bạn dị ứng.",
    extra: null,
  },
] as const;

/** Trình tự thật khi bắt đầu dùng Nouri (được đánh số vì là các bước nối tiếp). */
export const LANDING_STEPS = [
  { title: "Nhập thực phẩm vào kho", body: "Thêm những gì đang có trong tủ: tên, số lượng, đơn vị, hạn sử dụng. Kho cho thấy món nào cần dùng trước." },
  { title: "Điền hồ sơ ăn uống", body: "Tuổi, chiều cao, cân nặng, mục tiêu, chế độ ăn, dị ứng và món không thích. Chỉ tiêu mỗi ngày được tính từ hồ sơ này." },
  { title: "Tạo thực đơn 7 ngày", body: "Chọn ngày bắt đầu, Nouri xếp các bữa theo chỉ tiêu. Ăn xong bữa nào thì đánh dấu đã ăn để theo dõi calo trong ngày." },
  { title: "Đi chợ theo danh sách", body: "Mỗi thực đơn kèm danh sách nguyên liệu còn thiếu, chia theo nhóm. Mua xong món nào thì đánh dấu đã mua." },
] as const;

export const LANDING_COMMUNITY = [
  "Đăng món bạn vừa nấu kèm tối đa 4 ảnh và gắn công thức có sẵn trong Nouri, để người khác mở xem nguyên liệu và cách làm.",
  "Bạn thích và bình luận bài của người khác, nhận thông báo khi bài của mình có lượt thích hoặc bình luận, và tự xóa bài của mình khi cần.",
] as const;

/**
 * Mockup màn Thực đơn trong hero: một ngày mẫu gồm các món có thật trong bộ 33 món (tên, calo đúng như seed-data.ts), để minh họa
 * giao diện thật, không phải số liệu quảng cáo. `day`: ngày đang xem trong dải 7 ngày.
 */
export const HERO_MEAL_PLAN = {
  days: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  day: "T4",
  meals: [
    { mealType: "BREAKFAST", name: "Bánh mì ốp la", calories: 410 },
    { mealType: "LUNCH", name: "Bún chả Hà Nội", calories: 640 },
    { mealType: "DINNER", name: "Canh chua cá lóc", calories: 470 },
  ],
} as const;

/** Câu dẫn của phần "Món trong Nouri". */
export const LANDING_RECIPE_INTRO = "Nouri mang đến bộ sưu tập công thức món ăn, ưu tiên những món Việt quen thuộc, dễ nấu tại nhà. "
  + "Mỗi công thức đều có nguyên liệu, hướng dẫn chế biến và thông tin dinh dưỡng chi tiết cho một khẩu phần.";
