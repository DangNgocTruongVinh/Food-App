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
   Thành phần phổ biến (khởi đầu lạnh): `w_pop = (1 − γ_u) · w_pop0`, các thành phần khác nhân `(1 − w_pop)`; điểm phổ biến của món
   = Σ_u r_ui của mọi người (kể cả tài khoản mẫu), vẫn sau lọc an toàn; lý do "Nhiều người đang nấu món này". w_pop0 chọn ở mục 8
   (bảng 4): hiện **0** vì không đạt ngưỡng (xem nhận xét).
5. Đa dạng hóa MMR: chọn lần lượt `argmax 0,8 · S(r) − 0,2 · max_{s đã chọn} cos(v_r, v_s)`.
6. Lý do: thành phần có `w_a' · ŝ_a` lớn nhất, rồi tiêu chí con lớn nhất của nó (khối đặc trưng, tiêu chí của thuật toán 3, món
   "vì" của thuật toán 2). Ví dụ: "Dùng 2 thực phẩm sắp hết hạn: Đậu hũ, Ức gà", "Có nguyên liệu bạn hay dùng: Gừng, Ức gà",
   "Người hay nấu Bún xào chay cũng nấu món này".

| Ngữ cảnh (`context`) | Dùng ở | w1 (nội dung) | w2 (cộng tác) | w3 (tri thức) |
|---|---|---|---|---|
| `today` | Tổng quan: hôm nay nấu gì | 0,35 | 0,25 | 0,40 |
| `for-you` | Công thức: Dành cho bạn | 0,60 | 0,20 | 0,20 (chốt sau đánh giá, mục 8; ban đầu 0,45/0,30/0,25) |
| `pantry` | Kho: Nấu gì từ kho, Gợi ý món cho thực phẩm X | 0,15 | 0,10 | 0,75 |
| `similar` | Chi tiết món: Món tương tự | 1 | 0 | 0 |
| `also-cooked` | Chi tiết món: Người khác cũng nấu | 0 | 1 | 0 |

Hiệu năng (đo riêng bằng `npm run test:perf -w backend`): một lần gợi ý với 33 món dưới 10 ms; 500 món × 1.000 người dùng,
hồ sơ có dị ứng, khoảng 70 ms (ngưỡng kiểm 150 ms).

## 8. Đánh giá trên dữ liệu mô phỏng

<!-- EVAL:START -->
Sinh bằng `npm run eval:recommend -w backend`: 5 lần mô phỏng (seed 20261103–20261107), mỗi lần 80 người, 6 nhóm khẩu vị, 28 ngày; trung bình 1544 tương tác mỗi lần. Dữ liệu **mô phỏng**, chỉ trong bộ nhớ, không có trong cơ sở dữ liệu. Ngữ cảnh "for-you", K = 5 và 10; số trong bảng là trung bình 5 lần.

**Bảng 1 — Tập kiểm tra (20% tương tác cuối của mỗi người).**

| Phương pháp | P@5 | R@5 | P@10 | R@10 (± độ lệch giữa các lần) | R@10 món mới | Độ phủ | Đa dạng | Lệch calo | Có đồ sắp hết hạn | Vi phạm an toàn |
|---|---|---|---|---|---|---|---|---|---|---|
| Ngẫu nhiên | 0,096 | 0,162 | 0,099 | 0,352 ± 0,025 | 0,323 | 100,0% | 0,757 | 42,2% | 65,0% | 0,0% |
| Phổ biến nhất | 0,185 | 0,378 | 0,149 | 0,564 ± 0,057 | 0,386 | 61,8% | 0,778 | 46,3% | 64,5% | 0,0% |
| Phổ biến nhất (không lọc an toàn) | 0,164 | 0,338 | 0,137 | 0,524 ± 0,045 | 0,339 | 30,3% | 0,791 | 46,2% | 65,3% | 11,8% |
| TT1 Nội dung | 0,248 | 0,443 | 0,171 | 0,618 ± 0,015 | 0,268 | 100,0% | 0,607 | 38,7% | 62,2% | 0,0% |
| TT2 Cộng tác | 0,062 | 0,119 | 0,059 | 0,235 ± 0,023 | 0,602 | 99,4% | 0,793 | 43,1% | 66,8% | 0,0% |
| TT3 Tri thức | 0,108 | 0,194 | 0,104 | 0,377 ± 0,041 | 0,378 | 100,0% | 0,710 | 33,0% | 85,3% | 0,0% |
| Bộ trộn (Nội dung mạnh (0,60/0,20/0,20)) | 0,228 | 0,418 | 0,163 | 0,590 ± 0,017 | 0,308 | 100,0% | 0,620 | 37,1% | 79,5% | 0,0% |
| Bộ trộn + phổ biến (w_pop0 = 0,3, không đạt ngưỡng) | 0,241 | 0,456 | 0,170 | 0,622 ± 0,021 | 0,347 | 100,0% | 0,653 | 38,2% | 78,5% | 0,0% |

**Bảng 2 — R@10 theo số tương tác trong tập huấn luyện (khởi đầu lạnh; gộp người của 5 lần).**

| Phương pháp | 0 tương tác (39 người) | 1–5 tương tác (56 người) | >5 tương tác (305 người) |
|---|---|---|---|
| Ngẫu nhiên | 0,231 | 0,357 | 0,366 |
| Phổ biến nhất | 0,538 | 0,554 | 0,569 |
| Phổ biến nhất (không lọc an toàn) | 0,513 | 0,536 | 0,523 |
| TT1 Nội dung | 0,308 | 0,536 | 0,673 |
| TT2 Cộng tác | 0,462 | 0,339 | 0,187 |
| TT3 Tri thức | 0,359 | 0,446 | 0,366 |
| Bộ trộn (Nội dung mạnh (0,60/0,20/0,20)) | 0,256 | 0,571 | 0,636 |
| Bộ trộn + phổ biến (w_pop0 = 0,3, không đạt ngưỡng) | 0,308 | 0,643 | 0,658 |

**Bảng 3 — Chọn trọng số bộ trộn trên tập kiểm định (20% cuối của tập huấn luyện; tập kiểm tra không dùng để chọn).**

| Bộ trọng số (nội dung/cộng tác/tri thức) | R@10 kiểm định | P@10 kiểm định | Đa dạng | Có đồ sắp hết hạn |
|---|---|---|---|---|
| Kế hoạch (0,45/0,30/0,25) | 0,627 | 0,149 | 0,647 | 84,2% |
| Như Tổng quan (0,35/0,25/0,40) | 0,585 | 0,138 | 0,669 | 85,0% |
| Bằng nhau (1/3) | 0,594 | 0,139 | 0,669 | 85,0% |
| Nội dung mạnh (0,60/0,20/0,20) **(chọn)** | 0,660 | 0,158 | 0,629 | 80,6% |
| Cộng tác mạnh (0,30/0,50/0,20) | 0,593 | 0,138 | 0,665 | 84,5% |
| Tri thức mạnh (0,25/0,25/0,50) | 0,519 | 0,121 | 0,684 | 85,3% |

Quy tắc chọn: giữ bộ trọng số của kế hoạch trừ khi bộ khác có R@10 kiểm định trung bình cao hơn ít nhất 0,01. Bộ cao nhất: Nội dung mạnh (0,60/0,20/0,20) (0,660 so với 0,627) → chọn **Nội dung mạnh (0,60/0,20/0,20)**.

**Bảng 4 — Chọn w_pop0 của thành phần phổ biến (khởi đầu lạnh) trên tập kiểm định, với bộ trọng số đã chọn.**

| w_pop0 | R@10 kiểm định, tất cả | R@10 kiểm định, 0 tương tác | R@10 kiểm định, 1–5 tương tác | Đa dạng | Có đồ sắp hết hạn |
|---|---|---|---|---|---|
| 0,0 **(chọn)** | 0,660 | 0,556 | 0,690 | 0,629 | 80,6% |
| 0,1 | 0,656 | 0,667 | 0,638 | 0,636 | 80,6% |
| 0,2 | 0,659 | 0,667 | 0,621 | 0,645 | 79,7% |
| 0,3 | 0,669 | 0,778 | 0,621 | 0,658 | 79,0% |
| 0,4 | 0,667 | 0,778 | 0,603 | 0,677 | 77,5% |
| 0,5 | 0,664 | 0,778 | 0,586 | 0,697 | 77,8% |

Quy tắc chọn (như bảng 3): giữ w_pop0 = 0 trừ khi giá trị khác có R@10 kiểm định (tất cả người) cao hơn ít nhất 0,01. Cao nhất: w_pop0 = 0,3 (0,669 so với 0,660) → chọn **w_pop0 = 0,0**.

**Bảng 5 — Bộ trộn trước/sau khi thêm thành phần phổ biến w_pop0 = 0,3 (giá trị tốt nhất ở bảng 4; tập kiểm tra, R@10 theo số tương tác).**

| Nhóm | Trước (w_pop0 = 0) | Sau (w_pop0 = 0,3) |
|---|---|---|
| 0 tương tác (39 người) | 0,256 | 0,308 |
| 1–5 tương tác (56 người) | 0,571 | 0,643 |
| >5 tương tác (305 người) | 0,636 | 0,658 |
| Tất cả | 0,590 | 0,622 |

Thời gian chạy: 31.7 s.
<!-- EVAL:END -->

**Nhận xét** (dựa trên các bảng trên; cùng xu hướng ở cả 5 lần mô phỏng):

- **Thuật toán 1 (nội dung)** đúng nhất khi người dùng đã có lịch sử (R@10 0,62; với > 5 tương tác 0,67) vì khẩu vị trong dữ liệu
  bám theo đặc trưng món. Điểm yếu: ít đa dạng nhất (0,61) và hay gợi ý lại món đã ăn — "R@10 món mới" thấp nhất (0,27). Khi chưa
  có lịch sử chỉ còn tiên nghiệm từ hồ sơ nên kém (0,31).
- **Thuật toán 2 (cộng tác)** có R@10 chung thấp nhất trong ba thuật toán vì theo thiết kế không gợi ý lại món người dùng đã tương
  tác (mà món ăn thì hay được ăn lại). Đổi lại, nó **mạnh nhất ở món mới** (R@10 món mới 0,60, gấp đôi thuật toán 1): tìm món người
  dùng chưa từng nấu nhưng người cùng khẩu vị hay nấu. Cần dữ liệu của nhiều người; lý do này cũng là vì sao cần tài khoản mẫu khi demo.
- **Thuật toán 3 (tri thức)** không nhắm tới "đoán món sẽ ăn" (R@10 0,38) mà tới mục tiêu sản phẩm: lệch calo thấp nhất (33%) và
  85% danh sách có món dùng đồ sắp hết hạn (ngẫu nhiên: 65%).
- **Bộ trộn** gần bằng thuật toán 1 về độ đúng (R@10 0,59 so với 0,62), tốt nhất ở nhóm 1–5 tương tác (0,57), nhưng giữ được phần lớn
  lợi ích của thuật toán 3 (lệch calo 37%, 80% danh sách dùng đồ sắp hết hạn) và gợi ý món mới tốt hơn thuật toán 1 (0,31 so với 0,27).
  Đó là đánh đổi mong muốn: một chút độ đúng để đổi lấy giảm lãng phí và dinh dưỡng hợp mục tiêu.
- **Khởi đầu lạnh (0 tương tác):** "phổ biến nhất" tốt nhất (0,54); bộ trộn chỉ 0,26 vì khi chưa có lịch sử, trọng số thuật toán 2
  bằng 0 và thuật toán 1 chỉ dựa vào hồ sơ. Đã thử thêm thành phần phổ biến `w_pop = (1 − γ_u)·w_pop0` (bảng 4, 5): trên tập kiểm định,
  w_pop0 = 0,3 giúp nhóm 0 tương tác (0,556 → 0,778) nhưng làm giảm nhóm 1–5 tương tác (0,690 → 0,621), R@10 chung chỉ tăng 0,009 —
  dưới ngưỡng 0,01 nên theo quy tắc đặt trước **giữ w_pop0 = 0** (thành phần có sẵn trong mã nhưng đang tắt). Trên tập kiểm tra,
  0,3 lại tốt hơn ở mọi nhóm (0 tương tác 0,256 → 0,308; tất cả 0,590 → 0,622), nhưng không dùng tập kiểm tra để chọn tham số.
  Tập kiểm định có ít người mới (mỗi lần mô phỏng vài người) nên kết luận ở nhóm này còn nhiễu.
- **Lọc an toàn là bắt buộc:** mọi phương pháp chạy sau lọc an toàn đều 0% vi phạm; "phổ biến nhất" không lọc có 11,8% món vi phạm dị
  ứng/chế độ ăn/món không thích của chính người được gợi ý.
- **Chọn trọng số:** sáu bộ trọng số được so trên tập kiểm định (không dùng tập kiểm tra) theo quy tắc đặt trước; bộ "nội dung mạnh"
  (0,60/0,20/0,20) hơn bộ ban đầu 0,036 R@10 nên được chốt cho ngữ cảnh `for-you`. Các ngữ cảnh `today` và `pantry` giữ trọng số theo
  mục tiêu sản phẩm (dùng đồ sắp hết hạn, dinh dưỡng trong ngày), vì đánh giá "đoán món sẽ ăn" không đo được mục tiêu đó.

**Hạn chế của dữ liệu mô phỏng:**

- Khẩu vị được sinh từ luật theo đặc trưng món, nên dữ liệu thiên vị thuật toán 1 dù đã thêm "món ruột" ngẫu nhiên mỗi nhóm; con số
  tuyệt đối không nói lên hiệu quả với người dùng thật.
- Bộ món nhỏ (33 món, ~25 món an toàn mỗi người): chọn 10 món đã trùng một phần lớn bộ món, nên Recall@10 cao kể cả với ngẫu nhiên
  (0,35); nên so sánh tương đối giữa các phương pháp, không đọc như số đo thực tế.
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
