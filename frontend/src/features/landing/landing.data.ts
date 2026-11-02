/** Nội dung tĩnh của Landing (chữ mô tả chức năng có thật; số liệu lấy từ API, không đặt ở đây). */

export const LANDING_SECTIONS = [
  { id: "nouri-giup-gi", label: "Nouri giúp gì" },
  { id: "mon-an", label: "Món ăn" },
  { id: "cach-hoat-dong", label: "Cách hoạt động" },
  { id: "cong-dong", label: "Cộng đồng" },
] as const;

/** Ba việc chính. Việc đầu là việc người dùng làm hằng ngày nên đặt lớn hơn. */
export const LANDING_BENEFITS = [
  {
    title: "Biết trong tủ còn gì",
    body: "Mỗi thực phẩm có số lượng, hạn sử dụng và nơi bảo quản: ngăn mát, ngăn đông hay nơi khô ráo. "
      + "Nouri báo khi một món còn 3 ngày là hết hạn, khi đã hết hạn, và khi số lượng xuống tới mức tối thiểu bạn đặt.",
  },
  {
    title: "Thực đơn 7 ngày theo hồ sơ",
    body: "Từ tuổi, chiều cao, cân nặng, mức vận động và mục tiêu, Nouri tính calo, đạm, tinh bột, béo cho mỗi ngày rồi xếp 3 hoặc 4 bữa. "
      + "Ăn chay, thuần chay thì chỉ có món đúng chế độ; món có thành phần bạn dị ứng bị loại.",
  },
  {
    title: "Bớt đồ phải bỏ đi",
    body: "Danh sách đi chợ chỉ gồm phần nguyên liệu thực đơn cần mà kho chưa có. "
      + "Ở trang Tổng quan, món dùng nguyên liệu sắp hết hạn được gợi ý trước.",
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
