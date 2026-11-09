// Tên thường gặp trên hóa đơn siêu thị (đã bỏ dấu, chữ thường) → tên thực phẩm có dấu. Dùng sau tên trong kho và tên
// nguyên liệu của công thức (receipt-normalize.ts): chỉ bổ sung tên gọi khác/viết tắt và tên chưa có trong bộ món.
// Khớp theo tiền tố nguyên từ: "trung ga ta hop 10" khớp "trung ga". Dữ liệu tĩnh; thêm dòng khi gặp hóa đơn mới.
export const RECEIPT_ALIASES: Array<[string, string]> = [
  ["thit lon", "Thịt heo"], ["thit heo", "Thịt heo"], ["thit heo xay", "Thịt heo xay"], ["thit xay", "Thịt heo xay"],
  ["ba roi", "Thịt ba chỉ"], ["ba chi", "Thịt ba chỉ"], ["thit ba roi", "Thịt ba chỉ"], ["suon non", "Sườn non"],
  ["thit bo", "Thịt bò"], ["bo xay", "Thịt bò xay"], ["uc ga", "Ức gà"], ["dui ga", "Đùi gà"], ["canh ga", "Cánh gà"],
  ["ga ta", "Gà ta"], ["ca hoi", "Cá hồi"], ["ca basa", "Cá basa"], ["ca thu", "Cá thu"], ["tom su", "Tôm sú"],
  ["tom the", "Tôm thẻ"], ["muc ong", "Mực ống"],
  ["trung ga", "Trứng gà"], ["trung vit", "Trứng vịt"], ["trung cut", "Trứng cút"],
  ["sua tuoi", "Sữa tươi"], ["sua chua", "Sữa chua"], ["sua dac", "Sữa đặc"], ["sua dau nanh", "Sữa đậu nành"],
  ["dau hu", "Đậu hũ"], ["dau phu", "Đậu hũ"], ["tau hu", "Đậu hũ"],
  ["gao", "Gạo"], ["gao st", "Gạo"], ["bun tuoi", "Bún tươi"], ["banh pho", "Bánh phở"], ["banh mi", "Bánh mì"],
  ["mi goi", "Mì gói"], ["mi tom", "Mì gói"], ["mi an lien", "Mì gói"],
  ["ca chua", "Cà chua"], ["ca rot", "Cà rốt"], ["khoai tay", "Khoai tây"], ["khoai lang", "Khoai lang"],
  ["hanh tay", "Hành tây"], ["hanh la", "Hành lá"], ["hanh tim", "Hành tím"], ["toi", "Tỏi"], ["gung", "Gừng"],
  ["rau muong", "Rau muống"], ["cai thia", "Cải thìa"], ["cai ngot", "Cải ngọt"], ["bap cai", "Bắp cải"],
  ["dua leo", "Dưa leo"], ["dua chuot", "Dưa leo"], ["xa lach", "Xà lách"], ["bong cai xanh", "Bông cải xanh"],
  ["nam huong", "Nấm hương"], ["nam rom", "Nấm rơm"], ["gia do", "Giá đỗ"],
  ["chuoi", "Chuối"], ["tao", "Táo"], ["cam", "Cam"], ["xoai", "Xoài"], ["dua hau", "Dưa hấu"],
  ["nuoc mam", "Nước mắm"], ["nuoc tuong", "Nước tương"], ["xi dau", "Nước tương"], ["dau an", "Dầu ăn"],
  ["muoi", "Muối"], ["duong", "Đường"], ["hat nem", "Hạt nêm"], ["bot ngot", "Bột ngọt"], ["mi chinh", "Bột ngọt"],
];
