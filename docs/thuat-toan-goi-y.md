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
| — | Bộ trộn (hybrid), đa dạng hóa, lý do, API `GET /api/recommendations` | `hybrid.ts`, `reasons.ts`, `recommendation.*.ts` | R5 |

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

## 5. Thuật toán 3 — dựa trên tri thức, tối ưu đa tiêu chí

Chạy sau lọc an toàn. Điểm mềm `s3 = Σ_k α_k · f_k`, mỗi f_k ∈ [0, 1]:

| Tiêu chí | Công thức | α_k |
|---|---|---|
| Dùng đồ sắp hết hạn | `f_hạn = min(1, Σ_{p ∈ E(r)} (D + 1 − d_p)/(D + 1))`, E(r) = thực phẩm còn hạn ≤ D = 3 ngày món dùng, d_p = số ngày còn | 0,35 |
| Có trong kho | `f_kho = |nguyên liệu bắt buộc có trong kho, còn hạn| / |nguyên liệu bắt buộc|` | 0,25 |
| Dinh dưỡng | `f_dd = 0,6 · exp(−½ · ((kcal − E*)/(0,35 · E*))²) + 0,4 · min(1, đạm / P*)` | 0,20 |
| Đa dạng | `f_dạng = 1 − max_{s ∈ món đã ăn/xếp 3 ngày qua} cos(v_r, v_s)` (vector của thuật toán 1) | 0,10 |
| Ưu tiên chế độ ăn | `f_ưu = 1` nếu món có nhãn Ít tinh bột/Giàu đạm đúng hồ sơ | 0,10 |

E*, P* (calo, đạm mục tiêu của bữa): hôm nay đã ăn ít nhất một bữa → (mục tiêu ngày − đã ăn) / số bữa còn lại; chưa →
mục tiêu ngày × tỷ lệ bữa (sáng 25%, trưa 35%, tối 30%, phụ 10%; không rõ bữa thì chia đều). Hạn sử dụng có trọng số lớn nhất
vì giảm lãng phí thực phẩm là mục tiêu chính của Nouri. Ngữ cảnh "gợi ý món cho thực phẩm X" thêm điều kiện cứng: món phải dùng X;
ngữ cảnh Kho chỉ xét món có ít nhất một nguyên liệu trong kho.

## 6. Bộ trộn

1. Ứng viên = lọc an toàn (luôn trước), cộng điều kiện của ngữ cảnh (bữa, thực phẩm X).
2. Chuẩn hóa min–max điểm từng thuật toán trên tập ứng viên: `ŝ_a = (s_a − min)/(max − min)`; mọi điểm bằng nhau → 0.
3. Khởi đầu lạnh: `γ_u = n_u/(n_u + 10)` (n_u = số món khác nhau đã tương tác); `w2' = w2 · γ_u`, phần `(1 − γ_u) · w2` chia cho
   w1, w3 theo tỷ lệ của chúng (tổng trọng số vẫn bằng 1).
4. `S = w1' · ŝ1 + w2' · ŝ2 + w3' · ŝ3`.
5. Đa dạng hóa MMR: chọn lần lượt `argmax 0,8 · S(r) − 0,2 · max_{s đã chọn} cos(v_r, v_s)`.
6. Lý do: thành phần có `w_a' · ŝ_a` lớn nhất, rồi tiêu chí con lớn nhất của nó (khối đặc trưng, tiêu chí của thuật toán 3, món
   "vì" của thuật toán 2). Ví dụ: "Dùng 2 thực phẩm sắp hết hạn: Đậu hũ, Ức gà", "Có nguyên liệu bạn hay dùng: Gừng, Ức gà",
   "Người hay nấu Bún xào chay cũng nấu món này".

| Ngữ cảnh (`context`) | Dùng ở | w1 (nội dung) | w2 (cộng tác) | w3 (tri thức) |
|---|---|---|---|---|
| `today` | Tổng quan: hôm nay nấu gì | 0,35 | 0,25 | 0,40 |
| `for-you` | Công thức: Dành cho bạn | 0,45 | 0,30 | 0,25 |
| `pantry` | Kho: Nấu gì từ kho, Gợi ý món cho thực phẩm X | 0,15 | 0,10 | 0,75 |
| `similar` | Chi tiết món: Món tương tự | 1 | 0 | 0 |
| `also-cooked` | Chi tiết món: Người khác cũng nấu | 0 | 1 | 0 |

Hiệu năng (đo riêng bằng `npm run test:perf -w backend`): một lần gợi ý với 33 món dưới 10 ms; 500 món × 1.000 người dùng,
hồ sơ có dị ứng, khoảng 70 ms (ngưỡng kiểm 150 ms).

## 7. Tài khoản mẫu minh họa

Cơ sở dữ liệu thật chỉ có vài tài khoản, chưa đủ để thuật toán 2 có cặp món đạt ngưỡng 3 người. Seed tạo 8 **tài khoản mẫu minh họa**
("Người dùng mẫu 1–8", `mau1–8@nouri.vn`, cờ `User.isSample`), thuộc 3 nhóm khẩu vị (ăn chay; tập luyện, giàu đạm; thích món quốc tế),
với hồ sơ và tương tác thật tạo bằng seed: một thực đơn tuần trước đã ăn, một bài viết gắn món, lượt thích bài của người cùng nhóm.
Mỗi món họ ăn đều an toàn với hồ sơ của chính họ (có test). Đây **không phải người dùng thật**: mật khẩu ngẫu nhiên không lưu ở đâu,
không ai đăng nhập được; không tính vào thống kê Admin; danh sách người dùng Admin gắn nhãn "Tài khoản mẫu"; `demo:reset` tạo lại.

Dữ liệu dùng để **đánh giá** thuật toán (R6) là dữ liệu mô phỏng riêng, sinh trong bộ nhớ, không đưa vào cơ sở dữ liệu.
