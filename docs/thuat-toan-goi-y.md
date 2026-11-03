# Thuật toán gợi ý món của Nouri

Tài liệu cho báo cáo đồ án (GĐ3b-R). Mã nguồn: `backend/src/modules/recommendation/`. Phần đánh giá bằng số liệu được bổ sung ở R6.

## 1. Tổng quan

Nouri dùng ba thuật toán và một bộ trộn:

| # | Thuật toán | File | Trạng thái |
|---|---|---|---|
| 0 | Lọc an toàn (luôn chạy trước) | `safety.ts` | R1 |
| 1 | Lọc theo nội dung (content-based) | `features.ts`, `content-based.ts` | R3 |
| 2 | Lọc cộng tác theo món (item-based collaborative filtering) | `interactions.ts`, `collaborative.ts` | R4 |
| 3 | Dựa trên tri thức, tối ưu đa tiêu chí (knowledge-based) | `knowledge-based.ts` | R5 |
| — | Bộ trộn (hybrid), đa dạng hóa, lý do | `hybrid.ts`, `reasons.ts` | R5 |

## 2. Lọc an toàn

Một món chỉ được gợi ý khi: chưa bị Admin ẩn; không chứa thành phần dị ứng (so theo nhóm, ví dụ "Hải sản" gồm tôm, cá, nước mắm…);
không chứa món người dùng không thích; đúng chế độ chay/thuần chay; đúng bữa (nếu ngữ cảnh có bữa). Bộ test ma trận
(`src/test/dietary-matrix.test.ts`, 105 hồ sơ) kiểm mọi nguồn gợi ý với một bảng đáp án viết tay.

## 3. Thuật toán 1 — lọc theo nội dung

Mỗi món là 5 khối đặc trưng, mỗi khối chuẩn hóa L2 riêng:

| Khối | Cách mã hóa | Trọng số w_b |
|---|---|---|
| Nguyên liệu | TF-IDF: tf = 1 (nguyên liệu tùy chọn 0,5), idf(t) = ln((1+N)/(1+df(t))) + 1 | 0,45 |
| Ẩm thực | one-hot | 0,15 |
| Bữa | multi-hot | 0,10 |
| Nhãn chế độ ăn | multi-hot | 0,10 |
| Dinh dưỡng | z-score của kcal, đạm, tinh bột, béo trên cả bộ món, cắt ±3, chia 3 | 0,20 |

Độ tương đồng: `sim(a, b) = Σ_b w_b · cos_b(a, b)`. Khi mọi khối của hai món đều khác 0, tổng này bằng đúng cosine của hai vector
ghép `[√w_b · x_b]` (đã kiểm bằng test trên bộ món seed), nên vừa là cosine chuẩn vừa tách được khối đóng góp lớn nhất để viết lý do.

Vector sở thích người dùng: `u = β·p_u + Σ_e ω(e) · e^(−Δ_e/τ) · v_{r(e)}`, β = 1, τ = 30 ngày; p_u là tiên nghiệm từ hồ sơ
(ẩm thực ưa thích, chế độ ăn, dinh dưỡng mục tiêu cho một bữa). Trọng số ω: đã ăn 3, đăng bài gắn món 3, thích bài gắn món 2,
có trong thực đơn nhưng chưa ăn 0,5. Người chưa có lịch sử dùng p_u (khởi đầu lạnh).

## 4. Thuật toán 2 — lọc cộng tác theo món

- `r_ui = ln(1 + Σ_e ω(e) · số lần · e^(−Δ_e/30))`, ω: đã ăn 3, đăng bài 3, thích bài 2 (phản hồi ngầm).
- `sim(i, j) = (Σ_u r_ui · r_uj) / (‖r_i‖ · ‖r_j‖) · n_ij / (n_ij + λ)`, λ = 5: co rút cặp món chỉ có ít người cùng tương tác.
- Giữ k = 20 hàng xóm gần nhất; dự đoán cho món chưa tương tác: `s2(u, j) = Σ_{i ∈ I_u ∩ N_k(j)} sim(i, j) · r_ui` (Deshpande–Karypis).
- "Người khác cũng nấu" chỉ hiện cặp món có ít nhất 3 người khác (không tính người đang xem) cùng tương tác; kết quả chỉ gồm id món và
  độ tương đồng, không lộ người dùng nào.
- Tương tác gom bằng GROUP BY trong SQL từ bảng có sẵn; mô hình tính trong bộ nhớ, cache 10 phút (500 món × 1.000 người: dưới 1 giây).

**Quyết định thiết kế — tránh vòng lặp phản hồi:** món "có trong thực đơn" do chính hệ thống xếp. Nếu đưa tín hiệu này vào
thuật toán 2, món được gợi ý sẽ vào thực đơn, rồi được coi là "nhiều người chọn" và được gợi ý nhiều hơn nữa, không phản ánh lựa
chọn thật của người dùng. Vì vậy "có trong thực đơn" chỉ dùng cho thuật toán 1 với trọng số thấp (0,5); thuật toán 2 chỉ dùng
hành động người dùng tự làm: đánh dấu đã ăn, đăng bài gắn món, thích bài gắn món.

**Vì sao không dùng phân rã ma trận hay học sâu:** bộ món có vài chục món, người dùng thật rất ít; ma trận quá thưa để học vector ẩn
mà không khớp nhiễu. Cách theo món giải thích được ("người nấu A cũng nấu B"), không cần huấn luyện, cập nhật ngay khi có tương tác mới.

## 5. Tài khoản mẫu minh họa

Cơ sở dữ liệu thật chỉ có vài tài khoản, chưa đủ để thuật toán 2 có cặp món đạt ngưỡng 3 người. Seed tạo 8 **tài khoản mẫu minh họa**
("Người dùng mẫu 1–8", `mau1–8@nouri.vn`, cờ `User.isSample`), thuộc 3 nhóm khẩu vị (ăn chay; tập luyện, giàu đạm; thích món quốc tế),
với hồ sơ và tương tác thật tạo bằng seed: một thực đơn tuần trước đã ăn, một bài viết gắn món, lượt thích bài của người cùng nhóm.
Mỗi món họ ăn đều an toàn với hồ sơ của chính họ (có test). Đây **không phải người dùng thật**: mật khẩu ngẫu nhiên không lưu ở đâu,
không ai đăng nhập được; không tính vào thống kê Admin; danh sách người dùng Admin gắn nhãn "Tài khoản mẫu"; `demo:reset` tạo lại.

Dữ liệu dùng để **đánh giá** thuật toán (R6) là dữ liệu mô phỏng riêng, sinh trong bộ nhớ, không đưa vào cơ sở dữ liệu.
