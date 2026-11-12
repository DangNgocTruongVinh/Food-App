# Số liệu cho quyển báo cáo

Tổng hợp mọi bảng số liệu từ mã và kết quả chạy thật, cập nhật 12/11/2026. Mỗi mục ghi **nguồn** và **loại dữ liệu**:
*đo thật* (chạy trên mã/máy thật), *mô phỏng* (người dùng giả lập sinh trong bộ nhớ, không có trong CSDL), *dữ liệu mẫu* (dựng sẵn cho demo).
Các bảng mục 2–3 được chép nguyên văn từ `docs/thuat-toan-goi-y.md` (phần do script sinh ra, giữa các dấu `EVAL`).

## 1. Kiểm thử tự động — đo thật

Chạy `npx vitest run` trong `backend/` và `frontend/` ngày 12/11/2026 trên nhánh `tai-lieu` (cùng mã chức năng với `main`):

| Phần | File test | Test | Kết quả |
|---|---|---|---|
| Backend | 65 | 1.221 | tất cả đạt |
| Frontend | 32 | 500 | tất cả đạt |
| **Tổng** | **97** | **1.721** | **tất cả đạt** |

Test không cần CSDL hay mạng: Prisma được giả lập (có transaction giả `backend/src/test/fake-transaction.ts`), OpenAI/Cloudinary/SMTP
dùng phản hồi giả lập, đồng hồ giả cho lịch nhắc hạn. Một số bộ test đáng chú ý:

| Bộ test | Kiểm gì | Nguồn |
|---|---|---|
| Ma trận an toàn | 105 hồ sơ (chế độ ăn × dị ứng × món không thích) × mọi nguồn gợi ý/thực đơn: không món nào vi phạm hoặc đã ẩn | `backend/src/test/dietary-matrix.test.ts` |
| Bảo mật phiên | refresh token xoay vòng, dùng lại → thu hồi chuỗi, khóa tài khoản, đổi mật khẩu, rate limit | `backend/src/modules/auth/*.test.ts`, `docs/test-evidence/bao-mat.md` |
| Quên mật khẩu | token sai/đã dùng/hết hạn, rate limit theo email và IP, email không tồn tại, tài khoản khóa, thu hồi phiên | `password-reset.test.ts` |
| Báo cáo | biên tuần theo giờ Việt Nam, "Nhập nhầm" không tính, ngày chưa ghi | `backend/src/modules/reports/reports.test.ts` |
| Kiểm kê nút Admin | mọi nút/hộp thoại khu Admin còn đủ | `frontend/src/features/admin/admin-controls.test.ts` |
| Quy tắc giao diện | CSS chỉ dùng token, không mã màu cứng, gradient, emoji | `frontend/src/features/ui/design-rules.test.ts` |

Hiệu năng gợi ý (`npm run test:perf -w backend`, *đo thật* trên máy dev): chạy lại 12/11/2026, 2/2 test đạt ngưỡng < 150 ms cho một
lần gợi ý với 33 món và với 500 món × 1.000 người dùng trong bộ nhớ. Lần đo ghi trong `docs/thuat-toan-goi-y.md`: 33 món dưới 10 ms;
500 món × 1.000 người khoảng 70 ms.

## 2. Đánh giá bộ gợi ý — mô phỏng

Nguồn: `docs/thuat-toan-goi-y.md` mục 8, lệnh `npm run eval:recommend -w backend`.

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
| Bộ trộn + phổ biến (w_pop0 = 0,3) | 0,241 | 0,456 | 0,170 | 0,622 ± 0,021 | 0,347 | 100,0% | 0,653 | 38,2% | 78,5% | 0,0% |

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
| Bộ trộn + phổ biến (w_pop0 = 0,3) | 0,308 | 0,643 | 0,658 |

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
| 0,0 | 0,660 | 0,556 | 0,690 | 0,629 | 80,6% |
| 0,1 | 0,656 | 0,667 | 0,638 | 0,636 | 80,6% |
| 0,2 | 0,659 | 0,667 | 0,621 | 0,645 | 79,7% |
| 0,3 **(chọn)** | 0,669 | 0,778 | 0,621 | 0,658 | 79,0% |
| 0,4 | 0,667 | 0,778 | 0,603 | 0,677 | 77,5% |
| 0,5 | 0,664 | 0,778 | 0,586 | 0,697 | 77,8% |

Tiêu chí riêng cho thành phần phổ biến (ngoại lệ có chủ đích so với ngưỡng 0,01 của bảng 3): mục tiêu là khởi đầu lạnh nên chọn theo R@10 kiểm định nhóm 0 tương tác, với điều kiện R@10 kiểm định tổng không giảm. Chọn **w_pop0 = 0,3**: nhóm 0 tương tác 0,556 → 0,778, tổng 0,660 → 0,669. Đánh đổi: nhóm 1–5 tương tác 0,690 → 0,621.

**Bảng 5 — Bộ trộn trước/sau khi thêm thành phần phổ biến w_pop0 = 0,3 (đã chọn ở bảng 4; tập kiểm tra, R@10 theo số tương tác — chỉ để xác nhận, không dùng chọn tham số).**

| Nhóm | Trước (w_pop0 = 0) | Sau (w_pop0 = 0,3) |
|---|---|---|
| 0 tương tác (39 người) | 0,256 | 0,308 |
| 1–5 tương tác (56 người) | 0,571 | 0,643 |
| >5 tương tác (305 người) | 0,636 | 0,658 |
| Tất cả | 0,590 | 0,622 |

Thời gian chạy: 17.4 s.

## 3. Đánh giá bộ tạo thực đơn tuần — mô phỏng

Nguồn: `docs/thuat-toan-goi-y.md` mục 9, lệnh `npm run eval:mealplan -w backend`.

Sinh bằng `npm run eval:mealplan -w backend`: 5 lần mô phỏng (seed 20261109–20261113), mỗi lần 100 người (500 thực đơn 7 ngày cho mỗi phương pháp). Hồ sơ ngẫu nhiên (5 chế độ ăn, 20% có một dị ứng, 10% có món không thích, 30% ăn 4 bữa), kho 8 thực phẩm (lượng 1–4 lần định lượng một món, hạn 0–10 ngày, 20% không có hạn), lịch sử 0–25 bữa đã ăn trong 4 tuần trước. Dữ liệu **mô phỏng**, chỉ trong bộ nhớ. Số trong bảng là trung bình trên mọi thực đơn.

| Phương pháp | Lệch calo ngày | Ngày lệch ≤ 10% | Lượng đồ sắp hết hạn dùng trước hạn | Đồ sắp hết hạn được dùng | Bữa lặp trong 3 ngày / thực đơn | Số món khác nhau | Vi phạm an toàn | Thời gian / thực đơn |
|---|---|---|---|---|---|---|---|---|
| Bộ tạo cũ (fallbackPlan) | 32,6% | 11,2% | 44,1% | 59,7% | 2,34 | 16,7 | 0,0% | 0,4 ms |
| Bộ tạo mới, không có khoảng calo (so sánh) | 28,0% | 17,3% | 59,2% | 74,5% | 1,60 | 16,6 | 0,0% | 9,1 ms |
| Bộ tạo mới (scoredPlan) **(dùng)** | 25,2% | 20,6% | 54,7% | 69,4% | 1,65 | 15,7 | 0,0% | 6,9 ms |
| OpenAI giả lập → reconcileAIPlan | 31,4% | 10,5% | 36,4% | 49,6% | 5,55 | 14,6 | 0,0% | 0,6 ms |

Giới hạn dưới của lệch calo ngày với bộ món hiện có (mỗi bữa chọn món chỉ theo calo, khẩu phần 1, bỏ mọi tiêu chí khác): 16,0%; mục tiêu calo trung bình của hồ sơ mô phỏng 2131 kcal/ngày.

"OpenAI giả lập": 3/500 thực đơn hỏng quá nửa số bữa nên dùng cả thực đơn của bộ tạo mới; còn lại bữa vi phạm được thay. Thời gian chạy: 10.6 s.

## 4. Tốc độ tải trang khi bật gzip — đo thật

Nguồn: `docs/test-evidence/2026-11-03_gd3b-l1_gzip.txt` (03/11/2026, trước các thay đổi giao diện sau đó).

GĐ3b lượt 1 — bật gzip ở nginx frontend (03/11/2026)
Đo bằng Playwright trên container frontend (nginx, bản build), cổng 8080, backend Docker; bộ nhớ đệm trống, trung vị 3 lần.
Điện thoại giả lập: mạng 1,6 Mb/s, độ trễ 150 ms, CPU chậm 4 lần. Dung lượng = tổng byte nhận về (JS, CSS, ảnh, phông, API).
Trước: cùng mã, chưa bật gzip (đo 03/11 khi nghiệm thu UI-12). Sau: bật gzip (HTML, JS, CSS, SVG, JSON kể cả API).
Tệp JS gói chính: 562.627 B gốc → 172.359 B khi nén (curl -H "Accept-Encoding: gzip").
Phần còn lại chủ yếu là phông (Google Fonts, woff2 vốn đã nén).

| Trang | Thiết bị | Trước FCP/LCP | Sau FCP/LCP | Trước KB (JS/CSS) | Sau KB (JS/CSS) |
|---|---|---|---|---|---|
| / | máy tính | 0,60/0,60 s | 0,51/0,51 s | 1023 (550/105) | 552 (169/17) |
| / | điện thoại | 5,14/5,14 s | 2,20/2,20 s | 976 (550/105) | 505 (169/17) |
| /login | máy tính | 0,44/0,44 s | 0,44/0,44 s | 973 (550/105) | 503 (169/17) |
| /login | điện thoại | 4,64/4,64 s | 1,98/1,98 s | 893 (550/105) | 503 (169/17) |
| /dashboard | máy tính | 0,34/0,46 s | 0,43/0,61 s | 1105 (550/105) | 574 (169/17) |
| /dashboard | điện thoại | 4,46/5,69 s | 2,18/3,00 s | 1105 (550/105) | 527 (169/17) |
| /pantry | máy tính | 0,43/0,54 s | 0,45/0,56 s | 1060 (550/105) | 588 (169/17) |
| /pantry | điện thoại | 4,49/5,29 s | 1,96/2,80 s | 1060 (550/105) | 588 (169/17) |
| /meal-plans | máy tính | 0,34/0,54 s | 0,54/0,60 s | 1083 (550/105) | 554 (169/17) |
| /meal-plans | điện thoại | 4,65/6,74 s | 2,12/2,75 s | 1082 (550/105) | 507 (169/17) |
| /recipes | máy tính | 0,36/0,48 s | 0,36/0,54 s | 1096 (550/105) | 569 (169/17) |
| /recipes | điện thoại | 4,54/7,18 s | 2,00/2,98 s | 1096 (550/105) | 569 (169/17) |
| /community | máy tính | 0,33/0,33 s | 0,35/0,35 s | 1070 (550/105) | 599 (169/17) |
| /community | điện thoại | 4,69/5,30 s | 2,37/2,37 s | 1023 (550/105) | 348 (169/17) |
| /assistant | máy tính | 0,34/0,42 s | 0,46/0,51 s | 1062 (550/105) | 590 (169/17) |
| /assistant | điện thoại | 4,84/5,59 s | 2,02/2,54 s | 1015 (550/105) | 543 (169/17) |

## 5. Quét hóa đơn (OCR) — chưa có số liệu thật

Chưa có bộ ảnh hóa đơn thật trong `docs/test-evidence/receipts/` (chỉ có `README.md` và mẫu đáp án), nên **chưa có** tỉ lệ đọc đúng,
thời gian hay chi phí cho Tesseract và OpenAI. Khi có ~10 ảnh: `npm run eval:receipt -w backend` ghi `docs/test-evidence/receipts/ket-qua.md`
(tỉ lệ đúng dòng/tên/số lượng/đơn vị, thời gian và chi phí trung bình mỗi lần quét, USD/VNĐ theo giá token và tên model ghi trong file).
Hiện chỉ có test với dữ liệu giả lập (`backend/src/services/receipt/*.test.ts`, `receipt-scan.test.ts`).

## 6. Quy mô hệ thống — đo thật trên mã

| Mục | Số lượng | Nguồn |
|---|---|---|
| Endpoint API | 74 (công khai 10, đăng nhập 46, Admin 18) | `docs/bao-cao/api.md` (sinh từ routes) |
| Bảng CSDL / enum / quan hệ khóa ngoại | 21 / 16 / 29 | `docs/bao-cao/erd.md` (sinh từ `schema.prisma`) |
| Migration | 21 | `backend/prisma/migrations/` |
| Món trong bộ seed | 33 | `backend/prisma/seed-data.ts` |
| Use case | 26 khảo sát (14 đã làm, 10 làm khác, 2 chưa làm) + 13 mới | `docs/bao-cao/use-case.md` |

## 7. Dữ liệu mẫu cho demo — dữ liệu mẫu, không phải hoạt động thật

| Dữ liệu | Nội dung | Nguồn |
|---|---|---|
| Tài khoản mẫu | 8 tài khoản `mau1–8@nouri.vn`, 3 nhóm khẩu vị, có thực đơn đã ăn, bài viết, lượt thích; không tính vào thống kê Admin | `backend/prisma/sample-accounts.ts` |
| Lịch sử demo (gợi ý) | ~2 tuần: một thực đơn đã qua, 12 bữa đã ăn, 3 lượt thích | `backend/prisma/demo-history.ts` |
| Kho demo | 8 thực phẩm, hạn tính từ ngày chạy (Đậu hũ 1 ngày, Ức gà 2 ngày, …, Gạo 90 ngày) | `backend/prisma/demo-account.ts` |
| Báo cáo demo | 8 tuần lịch sử kho: món bỏ đi mỗi tuần 4, 4, 3, 3, 2, 2, 1, 1; số lần dùng trước hạn / số lần dùng 1/3, 2/4, 2/4, 3/5, 4/5, 5/6, 6/6, 3/3; thực đơn mẫu 6 ngày qua có 12 bữa đã ăn (bỏ trống 1 ngày) | `backend/prisma/demo-report.ts` |

Mọi dữ liệu mẫu được tạo lại bằng `demo:reset`; số trên trang Báo cáo của demo vì vậy là số dựng sẵn để minh họa xu hướng, không dùng
làm kết quả đánh giá.
