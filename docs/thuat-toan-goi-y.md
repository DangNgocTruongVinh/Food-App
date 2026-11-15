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
| — | Bộ tạo thực đơn tuần (thuật toán 3 + 0,3 · thuật toán 1, mục 9) | `meal-plans/meal-plan-scorer.ts` | R8 |

## 2. Lọc an toàn

Một món chỉ được gợi ý khi: chưa bị Admin ẩn/xóa; không chứa thành phần dị ứng (theo nhóm); không chứa món người dùng không thích;
đúng chế độ chay/thuần chay; đúng bữa (nếu ngữ cảnh có bữa). Bộ test ma trận (`src/test/dietary-matrix.test.ts`, 105 hồ sơ + 14 cách
gõ dị ứng) kiểm mọi nguồn gợi ý với một bảng đáp án viết tay.

**Dị ứng theo nhóm (sửa lỗi 13/11/2026).** Lỗi cũ: hồ sơ ghi "trứng gà" không lọc "Bánh mì ốp la" (nguyên liệu "Trứng") vì chỉ
nhận đúng tên nhóm và so khớp một chiều theo chữ. Nay dùng một danh mục chung cho backend và frontend
(`backend/src/services/allergy-groups.ts`, frontend chép y nguyên, test so hai file): 11 nhóm — Trứng, Sữa, Hải sản (= Cá + Giáp xác +
Nhuyễn thể), Đậu phộng, Hạt cây, Gluten, Đậu nành, Mè — mỗi nhóm có tên gọi khác (hai miền, tiếng Anh), nguyên liệu thuộc nhóm và
ngoại lệ ("Sữa đậu nành" thuộc Đậu nành, không thuộc Sữa).

| Bước | Quy tắc |
|---|---|
| Chuẩn hóa mục người dùng nhập | Bỏ từ thừa ("dị ứng", "bị", "với", "món"); gõ không dấu so không dấu, gõ có dấu so có dấu |
| Nhận nhóm | Dị ứng: trùng tên nhóm, tên gọi khác hoặc một nguyên liệu của nhóm → cả nhóm ("trứng gà", "trung ga", "egg", "lòng đỏ" → Trứng; "cá hồi" → Cá). Món không thích: chỉ tên nhóm/tên gọi khác mới thành nhóm, tên một nguyên liệu giữ đúng chữ |
| Dị ứng ≠ món không thích (13/11/2026) | Dị ứng (an toàn): mọi nguyên liệu của nhóm, cả chế biến/gia vị/thành phần ẩn (nước mắm, dầu hào, nước tương…) và "có thể chứa". Món không thích (khẩu vị): chỉ nguyên liệu chính (`mainTermsOf`, bỏ nguyên liệu đánh dấu chế biến — cột `AllergenTerm.processed`), không "có thể chứa" — không thích "cá" vẫn được Bún chả, Bún bò (chỉ có nước mắm), tránh Canh chua cá lóc; ghi đích danh "nước mắm" thì mới tránh nước mắm. Nhãn: "Chứa: Cá (Nước mắm)" / "Có thành phần bạn không thích: Cá lóc" |
| Không nhận ra | Vẫn lọc theo đúng chữ đó, nguyên từ, hai chiều ("thịt bò xay" ↔ "Thịt bò") — không bao giờ im lặng bỏ qua |
| Gần đúng | Sai 1–2 ký tự chỉ để gợi ý ("Có phải bạn muốn: Trứng?"), không tự áp |
| So với món | Nguyên từ trên tên món và tên nguyên liệu; cụm của danh mục luôn so đúng dấu ("chao" ≠ "cháo", "cá" ≠ "cà chua"); trừ ngoại lệ của nhóm |
| Hiển thị | Thẻ món vi phạm ghi "Chứa: Trứng (Trứng)", "Gluten (Bánh mì)" |

Cùng một hàm (`expandRestrictedTerms` / `findRestrictedTerms` trong `dietary.service.ts`) dùng ở gợi ý, thực đơn (cả kết quả AI qua
`reconcileAIPlan`), danh sách/tìm công thức, chi tiết món, trợ lý AI, quét hóa đơn, công thức thành viên và email nhắc hạn.

**Thành phần ẩn trong nguyên liệu chế biến (sửa lỗi 13/11/2026).** Lỗi cũ: "Bánh mì ốp la" có "Nước tương" vẫn được gợi ý cho người dị
ứng đậu nành/gluten. Danh mục nay gán nguyên liệu chế biến vào nhóm, một nguyên liệu có thể thuộc nhiều nhóm (Nước tương → Đậu nành +
Gluten). Chỗ tùy nhãn hàng gán theo hướng an toàn vào mục **"có thể chứa"** (`mayContain`): vẫn bị lọc khi dị ứng, thẻ món ghi
"Có thể chứa: Gluten (Tương đen)" thay vì "Chứa: …"; "Món không thích" chỉ dùng nguyên liệu chắc chắn của nhóm.

| Nguyên liệu chế biến | Nhóm (chắc chắn) | Có thể chứa | Trong 33 món seed |
|---|---|---|---|
| Nước tương, xì dầu | Đậu nành, Gluten | — | Có (Nước tương) |
| Tương đen | Đậu nành | Gluten, Mè | Có |
| Tương ớt Hàn Quốc (gochujang) | Đậu nành | Gluten | Có |
| Tương bần, tương hột, miso, chao, tàu hũ ky, váng đậu | Đậu nành | Gluten (miso) | — |
| Đậu hũ, sữa đậu nành | Đậu nành | — | Có |
| Dầu hào | Nhuyễn thể (Hải sản) | Gluten, Đậu nành | — |
| Nước mắm, mắm nêm, mắm cá | Cá (Hải sản) | — | Có (Nước mắm) |
| Mắm tôm, mắm ruốc, ruốc, bánh phồng tôm | Giáp xác (Hải sản) | — | — |
| Bánh mì, mì, mì Ý, bột mì, bột chiên giòn/xù, bánh bao, mì căn | Gluten | — | Có (Bánh mì, Mì Ý) |
| Yến mạch, bún tàu | — | Gluten (dễ lẫn lúa mì) | Có (Yến mạch) |
| Mayonnaise, sốt trứng | Trứng | — | — |
| Bơ, phô mai, kem, kem tươi, sữa tươi/chua/đặc | Sữa | — | Có (Phô mai feta, Sữa tươi, Sữa chua, Sữa đặc) |
| Dầu mè, muối mè, mè rang, tahini | Mè | — | Có (Dầu mè, Mè rang) |
| Bơ đậu phộng, sốt đậu phộng | Đậu phộng | — | — |
| Sa tế, tương đậu phộng | — | Đậu phộng | — |

Ngoại lệ giữ đúng: bánh phở, bún gạo, bánh tráng không phải gluten; "mì chính" (bột ngọt), "mì Quảng" (bột gạo) không tính "mì";
"Quả bơ", "Sinh tố bơ", "Bơ đậu phộng" không phải sữa; "cháo" ≠ "chao"; "Tương ớt" thường không tính đậu nành. Hệ quả trên dữ liệu
seed: người thuần chay dị ứng gluten không còn món trưa/tối an toàn (món mặn chay đều có nước tương) — bộ tạo thực đơn lấy món an toàn
khác bữa thay vì món vi phạm.

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
   Thành phần phổ biến (khởi đầu lạnh): `w_pop = (1 − γ_u) · w_pop0`, các thành phần khác nhân `(1 − w_pop)`; điểm phổ biến của món
   = Σ_u r_ui của mọi người (kể cả tài khoản mẫu), vẫn sau lọc an toàn; lý do "Nhiều người đang nấu món này". w_pop0 chọn ở mục 8
   (bảng 4): **0,3** (chốt ở lần đánh giá 3/11/2026; lần chạy lại 15/11 quy tắc chọn ra 0,4 — chưa đổi tham số, xem mục 10).
5. Đa dạng hóa MMR: chọn lần lượt `argmax 0,8 · S(r) − 0,2 · max_{s đã chọn} cos(v_r, v_s)`.
6. Lý do: thành phần có `w_a' · ŝ_a` lớn nhất, rồi tiêu chí con lớn nhất của nó (khối đặc trưng, tiêu chí của thuật toán 3, món
   "vì" của thuật toán 2). Ví dụ: "Dùng 2 thực phẩm sắp hết hạn: Đậu hũ, Ức gà", "Có nguyên liệu bạn hay dùng: Gừng, Ức gà",
   "Người hay nấu Bún xào chay cũng nấu món này".

| Ngữ cảnh (`context`) | Dùng ở | w1 (nội dung) | w2 (cộng tác) | w3 (tri thức) |
|---|---|---|---|---|
| `today` | Tổng quan: hôm nay nấu gì | 0,35 | 0,25 | 0,40 |
| `for-you` | Công thức: Dành cho bạn | 0,60 | 0,20 | 0,20 (chốt sau đánh giá 3/11, mục 8; ban đầu 0,45/0,30/0,25; lần chạy lại 15/11 xem mục 10) |
| `pantry` | Kho: Nấu gì từ kho, Gợi ý món cho thực phẩm X | 0,15 | 0,10 | 0,75 |
| `similar` | Chi tiết món: Món tương tự | 1 | 0 | 0 |
| `also-cooked` | Chi tiết món: Người khác cũng nấu | 0 | 1 | 0 |

Hiệu năng (đo riêng bằng `npm run test:perf -w backend`, máy dev, commit `e8dfad3`, 15/11/2026, lần nhanh nhất trong 5 lần, 3 lần
chạy): một lần gợi ý với 33 món 3–5 ms; 500 món × 1.000 người dùng, hồ sơ có dị ứng, 86–99 ms (ngưỡng kiểm 150 ms; lần đo 3/11: khoảng
70 ms).

## 8. Đánh giá trên dữ liệu mô phỏng

<!-- EVAL:START -->
Mã ở commit `e8dfad3`, chạy ngày 15/11/2026.

Sinh bằng `npm run eval:recommend -w backend`: 5 lần mô phỏng (seed 20261103–20261107), mỗi lần 80 người, 6 nhóm khẩu vị, 28 ngày; trung bình 1488 tương tác mỗi lần. Dữ liệu **mô phỏng**, chỉ trong bộ nhớ, không có trong cơ sở dữ liệu. Ngữ cảnh "for-you", K = 5 và 10; số trong bảng là trung bình 5 lần.

**Bảng 1 — Tập kiểm tra (20% tương tác cuối của mỗi người).**

| Phương pháp | P@5 | R@5 | P@10 | R@10 (± độ lệch giữa các lần) | R@10 món mới | Độ phủ | Đa dạng | Lệch calo | Có đồ sắp hết hạn | Vi phạm an toàn |
|---|---|---|---|---|---|---|---|---|---|---|
| Ngẫu nhiên | 0,105 | 0,198 | 0,100 | 0,377 ± 0,027 | 0,368 | 100,0% | 0,754 | 42,5% | 61,7% | 0,0% |
| Phổ biến nhất | 0,184 | 0,399 | 0,148 | 0,608 ± 0,075 | 0,400 | 70,3% | 0,769 | 45,1% | 63,5% | 0,0% |
| Phổ biến nhất (không lọc an toàn) | 0,159 | 0,354 | 0,133 | 0,558 ± 0,066 | 0,350 | 30,3% | 0,778 | 44,6% | 64,3% | 13,5% |
| TT1 Nội dung | 0,258 | 0,510 | 0,171 | 0,651 ± 0,043 | 0,312 | 100,0% | 0,605 | 38,3% | 59,0% | 0,0% |
| TT2 Cộng tác | 0,059 | 0,120 | 0,055 | 0,230 ± 0,016 | 0,567 | 98,8% | 0,791 | 42,8% | 67,5% | 0,0% |
| TT3 Tri thức | 0,114 | 0,219 | 0,106 | 0,411 ± 0,029 | 0,410 | 100,0% | 0,707 | 33,3% | 85,3% | 0,0% |
| Bộ trộn (Kế hoạch (0,45/0,30/0,25)) | 0,211 | 0,438 | 0,156 | 0,619 ± 0,040 | 0,405 | 100,0% | 0,639 | 35,7% | 83,5% | 0,0% |
| Bộ trộn + phổ biến (w_pop0 = 0,4) | 0,234 | 0,492 | 0,166 | 0,671 ± 0,067 | 0,461 | 98,2% | 0,692 | 38,2% | 82,3% | 0,0% |

**Bảng 2 — R@10 theo số tương tác trong tập huấn luyện (khởi đầu lạnh; gộp người của 5 lần).**

| Phương pháp | 0 tương tác (44 người) | 1–5 tương tác (60 người) | >5 tương tác (296 người) |
|---|---|---|---|
| Ngẫu nhiên | 0,318 | 0,300 | 0,401 |
| Phổ biến nhất | 0,705 | 0,617 | 0,591 |
| Phổ biến nhất (không lọc an toàn) | 0,659 | 0,567 | 0,542 |
| TT1 Nội dung | 0,386 | 0,550 | 0,711 |
| TT2 Cộng tác | 0,341 | 0,400 | 0,179 |
| TT3 Tri thức | 0,409 | 0,367 | 0,421 |
| Bộ trộn (Kế hoạch (0,45/0,30/0,25)) | 0,386 | 0,617 | 0,654 |
| Bộ trộn + phổ biến (w_pop0 = 0,4) | 0,614 | 0,650 | 0,683 |

**Bảng 3 — Chọn trọng số bộ trộn trên tập kiểm định (20% cuối của tập huấn luyện; tập kiểm tra không dùng để chọn).**

| Bộ trọng số (nội dung/cộng tác/tri thức) | R@10 kiểm định | P@10 kiểm định | Đa dạng | Có đồ sắp hết hạn |
|---|---|---|---|---|
| Kế hoạch (0,45/0,30/0,25) **(chọn)** | 0,622 | 0,150 | 0,648 | 84,0% |
| Như Tổng quan (0,35/0,25/0,40) | 0,571 | 0,135 | 0,671 | 86,0% |
| Bằng nhau (1/3) | 0,578 | 0,136 | 0,670 | 86,0% |
| Nội dung mạnh (0,60/0,20/0,20) | 0,631 | 0,152 | 0,627 | 79,5% |
| Cộng tác mạnh (0,30/0,50/0,20) | 0,581 | 0,136 | 0,663 | 84,3% |
| Tri thức mạnh (0,25/0,25/0,50) | 0,518 | 0,121 | 0,683 | 86,0% |

Quy tắc chọn: giữ bộ trọng số của kế hoạch trừ khi bộ khác có R@10 kiểm định trung bình cao hơn ít nhất 0,01. Bộ cao nhất: Nội dung mạnh (0,60/0,20/0,20) (0,631 so với 0,622) → chọn **Kế hoạch (0,45/0,30/0,25)**.

**Bảng 4 — Chọn w_pop0 của thành phần phổ biến (khởi đầu lạnh) trên tập kiểm định, với bộ trọng số đã chọn.**

| w_pop0 | R@10 kiểm định, tất cả | R@10 kiểm định, 0 tương tác | R@10 kiểm định, 1–5 tương tác | Đa dạng | Có đồ sắp hết hạn |
|---|---|---|---|---|---|
| 0,0 | 0,622 | 0,200 | 0,559 | 0,648 | 84,0% |
| 0,1 | 0,626 | 0,400 | 0,559 | 0,654 | 83,5% |
| 0,2 | 0,641 | 0,600 | 0,588 | 0,664 | 83,5% |
| 0,3 | 0,651 | 0,600 | 0,618 | 0,679 | 83,5% |
| 0,4 **(chọn)** | 0,676 | 0,600 | 0,691 | 0,697 | 82,6% |
| 0,5 | 0,667 | 0,600 | 0,632 | 0,712 | 82,1% |

Tiêu chí riêng cho thành phần phổ biến (ngoại lệ có chủ đích so với ngưỡng 0,01 của bảng 3): mục tiêu là khởi đầu lạnh nên chọn theo R@10 kiểm định nhóm 0 tương tác, với điều kiện R@10 kiểm định tổng không giảm. Chọn **w_pop0 = 0,4**: nhóm 0 tương tác 0,200 → 0,600, tổng 0,622 → 0,676. Đánh đổi: nhóm 1–5 tương tác 0,559 → 0,691.

**Bảng 5 — Bộ trộn trước/sau khi thêm thành phần phổ biến w_pop0 = 0,4 (đã chọn ở bảng 4; tập kiểm tra, R@10 theo số tương tác — chỉ để xác nhận, không dùng chọn tham số).**

| Nhóm | Trước (w_pop0 = 0) | Sau (w_pop0 = 0,4) |
|---|---|---|
| 0 tương tác (44 người) | 0,386 | 0,614 |
| 1–5 tương tác (60 người) | 0,617 | 0,650 |
| >5 tương tác (296 người) | 0,654 | 0,683 |
| Tất cả | 0,619 | 0,671 |

Thời gian chạy: 19.3 s.
<!-- EVAL:END -->

**Nhận xét** (dựa trên các bảng trên — lần chạy 15/11/2026, commit `e8dfad3`; cùng xu hướng ở cả 5 lần mô phỏng):

- **Thuật toán 1 (nội dung)** đúng nhất trong ba thuật toán khi người dùng đã có lịch sử (R@10 0,651; với > 5 tương tác 0,711) vì khẩu
  vị trong dữ liệu bám theo đặc trưng món. Điểm yếu: ít đa dạng nhất (0,605) và hay gợi ý lại món đã ăn — "R@10 món mới" thấp nhất
  (0,312). Khi chưa có lịch sử chỉ còn tiên nghiệm từ hồ sơ nên kém (0,386).
- **Thuật toán 2 (cộng tác)** có R@10 chung thấp nhất (0,230) vì theo thiết kế không gợi ý lại món người dùng đã tương tác (mà món ăn
  thì hay được ăn lại). Đổi lại, nó **mạnh nhất ở món mới** (R@10 món mới 0,567, gần gấp đôi thuật toán 1): tìm món người dùng chưa từng
  nấu nhưng người cùng khẩu vị hay nấu. Cần dữ liệu của nhiều người; lý do này cũng là vì sao cần tài khoản mẫu khi demo.
- **Thuật toán 3 (tri thức)** không nhắm tới "đoán món sẽ ăn" (R@10 0,411) mà tới mục tiêu sản phẩm: lệch calo thấp nhất (33,3%) và
  85,3% danh sách có món dùng đồ sắp hết hạn (ngẫu nhiên: 61,7%).
- **Bộ trộn** (bộ trọng số kế hoạch 0,45/0,30/0,25, do quy tắc ở bảng 3 chọn) gần bằng thuật toán 1 về độ đúng (R@10 0,619 so với
  0,651) nhưng giữ được phần lớn lợi ích của thuật toán 3 (lệch calo 35,7%, 83,5% danh sách dùng đồ sắp hết hạn) và gợi ý món mới tốt
  hơn thuật toán 1 (0,405 so với 0,312). Đó là đánh đổi mong muốn: một chút độ đúng để đổi lấy giảm lãng phí và dinh dưỡng hợp mục tiêu.
- **Bộ trộn + phổ biến** (w_pop0 = 0,4 do bảng 4 chọn) có R@10 cao nhất mọi phương pháp (0,671), tốt nhất ở nhóm 1–5 tương tác (0,650)
  và món mới 0,461.
- **Khởi đầu lạnh (0 tương tác):** "phổ biến nhất" tốt nhất (0,705); bộ trộn chỉ 0,386 vì khi chưa có lịch sử, trọng số thuật toán 2
  bằng 0 và thuật toán 1 chỉ dựa vào hồ sơ. Thành phần phổ biến `w_pop = (1 − γ_u)·w_pop0` (bảng 4, 5) chọn trên tập kiểm định theo
  tiêu chí riêng (ngoại lệ có chủ đích so với ngưỡng 0,01 của R6, vì mục tiêu của thành phần này là khởi đầu lạnh): R@10 kiểm định nhóm
  0 tương tác 0,200 → 0,600 (bằng nhau ở w_pop0 = 0,2; 0,3; 0,4; 0,5), hòa thì lấy R@10 kiểm định tổng cao hơn → **w_pop0 = 0,4**
  (tổng 0,622 → 0,676; nhóm 1–5 tương tác cũng tăng 0,559 → 0,691). Bảng 5 (tập kiểm tra, chỉ để xác nhận, không dùng chọn tham số):
  nhóm 0 tương tác 0,386 → 0,614, nhóm 1–5 0,617 → 0,650, tổng 0,619 → 0,671. Tập kiểm định có ít người mới (mỗi lần mô phỏng vài người)
  nên kết luận ở nhóm này còn nhiễu.
- **Lọc an toàn là bắt buộc:** mọi phương pháp chạy sau lọc an toàn đều 0% vi phạm; "phổ biến nhất" không lọc có 13,5% món vi phạm dị
  ứng/chế độ ăn/món không thích của chính người được gợi ý.
- **Chọn trọng số:** sáu bộ trọng số được so trên tập kiểm định (không dùng tập kiểm tra) theo quy tắc đặt trước (chỉ đổi khi R@10 kiểm
  định cao hơn ít nhất 0,01). Lần chạy này bộ "nội dung mạnh" (0,60/0,20/0,20) cao nhất nhưng chỉ hơn bộ kế hoạch 0,009 (0,631 so với
  0,622) nên quy tắc giữ bộ kế hoạch. **Mã đang chạy vẫn dùng 0,60/0,20/0,20 cho `for-you` và w_pop0 = 0,3** — hai giá trị chốt ở lần
  đánh giá 3/11 (khi đó hơn 0,033 và chọn đúng quy tắc); chưa đổi tham số theo lần chạy lại, xem mục 10. Các ngữ cảnh `today` và
  `pantry` giữ trọng số theo mục tiêu sản phẩm (dùng đồ sắp hết hạn, dinh dưỡng trong ngày), vì đánh giá "đoán món sẽ ăn" không đo được
  mục tiêu đó.

**Hạn chế của dữ liệu mô phỏng:**

- Khẩu vị được sinh từ luật theo đặc trưng món, nên dữ liệu thiên vị thuật toán 1 dù đã thêm "món ruột" ngẫu nhiên mỗi nhóm; con số
  tuyệt đối không nói lên hiệu quả với người dùng thật.
- Bộ món nhỏ (33 món, ~25 món an toàn mỗi người): chọn 10 món đã trùng một phần lớn bộ món, nên Recall@10 cao kể cả với ngẫu nhiên
  (0,38); nên so sánh tương đối giữa các phương pháp, không đọc như số đo thực tế.
- Kho mô phỏng ngẫu nhiên (6 thực phẩm, hạn 0–11 ngày) nên tỷ lệ "có đồ sắp hết hạn" cao ở mọi phương pháp.
- Mô hình cộng tác được tính một lần từ tập huấn luyện của mọi người, nên với một người có thể đã thấy một phần tương tác của người khác
  xảy ra sau thời điểm gợi ý (rò rỉ nhẹ theo thời gian).
- Người dùng mô phỏng không phản ứng với gợi ý (không có vòng lặp phản hồi); đánh giá với người dùng thật là hướng phát triển.

## 7. Tài khoản mẫu minh họa

Cơ sở dữ liệu thật chỉ có vài tài khoản, chưa đủ để thuật toán 2 có cặp món đạt ngưỡng 3 người. Seed tạo 8 **tài khoản mẫu minh họa**
("Người dùng mẫu 1–8", `mau1–8@nouri.vn`, cờ `User.isSample`), thuộc 3 nhóm khẩu vị (ăn chay; tập luyện, giàu đạm; thích món quốc tế),
với hồ sơ và tương tác thật tạo bằng seed: một thực đơn tuần trước đã ăn, một bài viết gắn món, lượt thích bài của người cùng nhóm.
Mỗi món họ ăn đều an toàn với hồ sơ của chính họ (có test). Đây **không phải người dùng thật**: mật khẩu ngẫu nhiên không lưu ở đâu,
không ai đăng nhập được; không tính vào thống kê Admin; danh sách người dùng Admin gắn nhãn "Tài khoản mẫu"; `demo:reset` tạo lại.

**Lịch sử mẫu của tài khoản demo** (`backend/prisma/demo-history.ts`): `demo:reset` (và seed khi kho demo trống) tạo cho
`demo@nouri.vn` khoảng 2 tuần lịch sử mẫu tương đối theo ngày chạy — một thực đơn đã qua với 12 bữa đã ăn (món Việt, thích món cá,
vài món Nhật; "chỉ đánh dấu", không có lịch sử kho) và 3 lượt thích bài của tài khoản mẫu — để buổi demo không rơi vào khởi đầu
lạnh. Đây là dữ liệu mẫu, không phải hoạt động thật.

Dữ liệu dùng để **đánh giá** thuật toán (R6) là dữ liệu mô phỏng riêng, sinh trong bộ nhớ, không đưa vào cơ sở dữ liệu.

## 9. Bộ tạo thực đơn tuần (R8)

Mã nguồn: `backend/src/modules/meal-plans/meal-plan-scorer.ts` (`scoredPlan`), gọi từ `meal-plans.service.ts`. Không có
`OPENAI_API_KEY` (hoặc OpenAI trả thực đơn hỏng quá nửa số bữa) thì dùng bộ tạo này. Có key thì vẫn dùng OpenAI, kết quả luôn qua
`reconcileAIPlan` (đúng danh sách đã lọc an toàn, đúng bữa, không lặp trong ngày; bữa vi phạm được thay).

Bộ tạo chỉ **gọi lại** các hàm có sẵn của bộ gợi ý, không đổi công thức hay trọng số của chúng. Xếp lần lượt từng ngày, từng bữa:

1. Ứng viên = lọc an toàn (`safety.ts`: dị ứng, không thích, chay/thuần chay, món ẩn) + đúng bữa.
2. Điều kiện cứng khi còn lựa chọn (theo thứ tự): không lặp trong ngày; không lặp món của 2 ngày trước (không lặp trong 3 ngày liên
   tiếp, tính cả món đã ăn ngay trước ngày bắt đầu); calo trong ±35% mục tiêu bữa E* (cùng σ với `f_dd`).
3. Điểm `S = s3 + 0,3 · s1 − 0,1 · (số lần món đã được xếp trong tuần)`, s3 = thuật toán 3 (mục 5), s1 = thuật toán 1 (mục 3, lịch sử
   của người dùng). Khác với khi gợi ý:
   - **Kho ảo:** sau mỗi bữa trừ nguyên liệu như khi bấm "Đã ăn" (`planConsumption`: hạn sớm trước, quy đổi g↔kg, ml↔l, không trừ
     đồ đã hết hạn). Một thực phẩm sắp hết hạn chỉ được thưởng (`f_hạn`, `f_kho`) khi kho ảo còn, nên không bị dùng quá lượng đang có.
   - `now` = ngày của bữa: thực phẩm đã qua hạn ở ngày đó không được thưởng (chỉ các ngày trước hạn).
   - E*, P* (`mealTarget`) tính theo phần còn lại của ngày sau các bữa đã xếp, nên bữa sau bù cho bữa trước.
   - `f_dạng` so với món đã ăn/xếp trong 3 ngày gần nhất (kể cả các bữa đã xếp hôm đó).

Đánh giá (bộ tạo cũ `fallbackPlan`: xếp theo số nguyên liệu có trong kho + quy tắc giảm lặp, không xét calo hay hạn dùng):

<!-- EVAL-MEALPLAN:START -->
Mã ở commit `e8dfad3`, chạy ngày 15/11/2026.

Sinh bằng `npm run eval:mealplan -w backend`: 5 lần mô phỏng (seed 20261109–20261113), mỗi lần 100 người (500 thực đơn 7 ngày cho mỗi phương pháp). Hồ sơ ngẫu nhiên (5 chế độ ăn, 20% có một dị ứng, 10% có món không thích, 30% ăn 4 bữa), kho 8 thực phẩm (lượng 1–4 lần định lượng một món, hạn 0–10 ngày, 20% không có hạn), lịch sử 0–25 bữa đã ăn trong 4 tuần trước. Dữ liệu **mô phỏng**, chỉ trong bộ nhớ. Số trong bảng là trung bình trên mọi thực đơn.

| Phương pháp | Lệch calo ngày | Ngày lệch ≤ 10% | Lượng đồ sắp hết hạn dùng trước hạn | Đồ sắp hết hạn được dùng | Bữa lặp trong 3 ngày / thực đơn | Số món khác nhau | Vi phạm an toàn | Thời gian / thực đơn |
|---|---|---|---|---|---|---|---|---|
| Bộ tạo cũ (fallbackPlan) | 32,6% | 11,2% | 43,7% | 59,0% | 2,46 | 16,4 | 0,3% | 0,5 ms |
| Bộ tạo mới, không có khoảng calo (so sánh) | 28,1% | 17,0% | 58,4% | 73,5% | 1,72 | 16,5 | 0,3% | 11,1 ms |
| Bộ tạo mới (scoredPlan) **(dùng)** | 25,4% | 20,3% | 54,0% | 68,6% | 1,78 | 15,6 | 0,3% | 8,3 ms |
| OpenAI giả lập → reconcileAIPlan | 31,4% | 10,9% | 35,9% | 48,9% | 5,71 | 14,4 | 0,3% | 1,1 ms |

Giới hạn dưới của lệch calo ngày với bộ món hiện có (mỗi bữa chọn món chỉ theo calo, khẩu phần 1, bỏ mọi tiêu chí khác): 16,2%; mục tiêu calo trung bình của hồ sơ mô phỏng 2131 kcal/ngày.

"OpenAI giả lập": 6/500 thực đơn hỏng quá nửa số bữa nên dùng cả thực đơn của bộ tạo mới; còn lại bữa vi phạm được thay. Thời gian chạy: 14.1 s.
<!-- EVAL-MEALPLAN:END -->

**Nhận xét:**

- Bộ tạo mới tốt hơn bộ cũ ở cả ba mục tiêu: lệch calo thấp hơn, dùng được nhiều đồ sắp hết hạn hơn trước khi hỏng, ít bữa lặp hơn.
- **Không bữa nào vi phạm dị ứng, chế độ ăn hay món không thích** (mọi phương pháp chạy sau lọc an toàn; ma trận `dietary-matrix.test.ts`
  có nguồn `scoredPlan`). Cột "Vi phạm an toàn" còn tính cả **sai loại bữa**: 0,3% ở mọi phương pháp là đúng các bữa trưa/tối phải dùng
  món không đúng loại bữa (vd. "Khoai lang luộc" cho bữa tối) — 168 bữa tính chung 4 phương pháp, tất cả ở hồ sơ chay/thuần chay có dị
  ứng gluten. Từ khi nước tương thuộc nhóm Gluten (commit `b8bc55a`), các hồ sơ này gần như không còn món trưa/tối an toàn trong bộ
  33 món; bộ tạo chọn món an toàn của bữa khác thay vì món có gluten (an toàn trước, đúng bữa sau). Thêm món thuần chay không gluten
  là hướng phát triển (`docs/han-che.md`).
- **Ràng buộc calo ±35% (chốt giữ).** Hai dòng "Bộ tạo mới" trong bảng chỉ khác nhau ở ràng buộc này:

  | Bộ tạo mới | Lệch calo ngày | Lượng đồ sắp hết hạn dùng trước hạn |
  |---|---|---|
  | Có ràng buộc ±35% **(dùng)** | 25,4% | 54,0% |
  | Không có ràng buộc | 28,1% | 58,4% |

  Lý do giữ: (1) thực đơn tuần là kế hoạch ăn uống, nên khớp năng lượng theo bữa là yêu cầu của chức năng, còn dùng đồ sắp hết hạn là
  ưu tiên trong số các món đã hợp bữa; (2) bỏ ràng buộc thì món dùng đồ sắp hết hạn có thể lệch calo nhiều so với bữa (ví dụ món 600 kcal
  cho bữa sáng 450 kcal), lỗi dễ thấy với người dùng có mục tiêu giảm cân/tăng cơ; (3) có ràng buộc vẫn hơn hẳn bộ cũ ở cả hai chỉ số
  (lệch calo 32,6% → 25,4%; đồ sắp hết hạn 43,7% → 54,0%); (4) ±35% dùng lại σ của `f_dd`, không thêm tham số mới, và chỉ áp dụng
  khi có món trong khoảng (không có thì bỏ qua). Phần đồ sắp hết hạn bị mất (4,4 điểm) là đánh đổi được chấp nhận.
- Lệch calo còn lớn chủ yếu do bộ món: khẩu phần cố định 1, món nhiều nhất khoảng 660 kcal; với mục tiêu trên 2.000 kcal/ngày và
  3 bữa thì không đạt được (xem giới hạn dưới). Điều chỉnh khẩu phần theo mục tiêu là hướng phát triển.
- "Bữa lặp trong 3 ngày" của bộ mới không về 0 vì có hồ sơ chỉ còn ít món cho một bữa (ví dụ thuần chay ăn 4 bữa: 3 món bữa phụ).
- Bộ tạo mới chậm hơn (vài ms mỗi thực đơn) nhưng không đáng kể so với thời gian ghi DB.
- Hạn chế: dữ liệu mô phỏng; "dùng trước hạn" giả định người dùng ăn đúng thực đơn; kho ảo không tính đồ mua thêm trong tuần.

## 10. Lịch sử số liệu đánh giá

Các bảng ở mục 8 và 9 đã **đổi một lần**: bảng cũ sinh ở commit `e8a618f` (3/11/2026, gợi ý) và ngày 9/11/2026 (thực đơn); bảng mới
chạy lại ngày 15/11/2026 ở commit `e8dfad3`, **cùng phương pháp** (cùng seed, cùng cách chia tập kiểm định/kiểm tra, cùng quy tắc chọn).

**Commit làm đổi số: `b8bc55a` (13/11/2026) — sửa lỗi thành phần ẩn.** Trước đó, nguyên liệu chế biến và gia vị (nước tương, nước mắm,
dầu hào, tương đen…) không được tính vào nhóm dị ứng, nên "Bánh mì ốp la" (có nước tương) vẫn được gợi ý cho người dị ứng đậu nành hoặc
gluten. Sau khi sửa, các nguyên liệu này thuộc nhóm (nước tương → Đậu nành + Gluten, nước mắm → Cá, dầu hào → Nhuyễn thể…), nên người
dùng mô phỏng có dị ứng bị loại thêm món. Người mô phỏng chỉ "ăn" món an toàn với họ, nên chính dữ liệu mô phỏng cũng đổi (trung bình
1544 → 1488 tương tác mỗi lần), kéo theo mọi chỉ số. Nói gọn: **số đổi vì lọc an toàn chặt hơn, không phải vì thuật toán đổi.**
Đã chạy lại đánh giá ở từng commit từ `e8a618f` tới `1016df9` (10 commit đụng tới gợi ý, lọc an toàn, dữ liệu món): số giữ nguyên tới
`c3ced89`, đổi ở `b8bc55a`, rồi giữ nguyên tới nay (kể cả khi chuyển danh mục vào database và gom hằng số).

| Chỉ số (tập kiểm tra trừ khi ghi khác) | Cũ (3/11, `e8a618f`) | Mới (15/11, `e8dfad3`) |
|---|---|---|
| Tương tác mô phỏng trung bình mỗi lần | 1544 | 1488 |
| R@10 thuật toán 1 / 2 / 3 | 0,618 / 0,235 / 0,377 | 0,651 / 0,230 / 0,411 |
| R@10 ngẫu nhiên / phổ biến nhất | 0,352 / 0,564 | 0,377 / 0,608 |
| Bộ trọng số quy tắc chọn (bảng 3, R@10 kiểm định) | nội dung mạnh 0,660 > kế hoạch 0,627 (+0,033) → **0,60/0,20/0,20** | nội dung mạnh 0,631, kế hoạch 0,622 (+0,009 < 0,01) → **0,45/0,30/0,25** |
| w_pop0 quy tắc chọn (bảng 4) | **0,3** (nhóm 0 tương tác 0,556 → 0,778) | **0,4** (nhóm 0 tương tác 0,200 → 0,600; tổng 0,622 → 0,676) |
| R@10 bộ trộn / bộ trộn + phổ biến | 0,590 / 0,622 | 0,619 / 0,671 |
| "Phổ biến nhất" không lọc an toàn: món vi phạm | 11,8% | 13,5% |
| Thực đơn — lệch calo ngày: bộ cũ → bộ mới | 32,6% → 25,2% | 32,6% → 25,4% |
| Thực đơn — đồ sắp hết hạn dùng trước hạn: bộ cũ → bộ mới | 44,1% → 54,7% | 43,7% → 54,0% |
| Thực đơn — "Vi phạm an toàn" (gồm sai loại bữa) | 0,0% | 0,3% (chỉ sai loại bữa, xem mục 9) |
| Hiệu năng 500 món × 1.000 người | khoảng 70 ms | 86–99 ms (ngưỡng 150 ms) |

**Quyết định cũ không còn đúng theo quy tắc chọn (chưa đổi tham số, chờ quyết định):** (1) trọng số `for-you` đang là 0,60/0,20/0,20,
lần chạy lại quy tắc giữ bộ kế hoạch 0,45/0,30/0,25 (bộ nội dung mạnh vẫn cao nhất nhưng chênh dưới ngưỡng 0,01); (2) w_pop0 đang là
0,3, lần chạy lại quy tắc chọn 0,4 (nhóm 0 tương tác bằng nhau ở 0,2–0,5, chọn theo R@10 kiểm định tổng: 0,651 ở 0,3, 0,676 ở 0,4).
Bảng 1–2, 5 đo cấu hình mà quy tắc chọn ra, không phải cấu hình đang chạy.
