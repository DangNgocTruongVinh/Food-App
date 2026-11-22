# Số liệu cho quyển báo cáo

Tổng hợp mọi bảng số liệu từ mã và kết quả chạy thật, cập nhật 12/11/2026 (rà soát cuối); hiệu năng và mục 6 (quy mô) đếm/chạy lại 15/11/2026; mục 1–3 chạy lại 22/11/2026 (sau khi sửa lệch ngày UTC/giờ VN, audit H1). Mỗi mục ghi **nguồn** và **loại dữ liệu**:
*đo thật* (chạy trên mã/máy thật), *mô phỏng* (người dùng giả lập sinh trong bộ nhớ, không có trong CSDL), *dữ liệu mẫu* (dựng sẵn cho demo).
Các bảng mục 2–3 được chép nguyên văn từ `docs/thuat-toan-goi-y.md` (phần do script sinh ra, giữa các dấu `EVAL`).

## 1. Kiểm thử tự động — đo thật

Chạy `npm test` (Vitest, `backend/` và `frontend/`) ngày 22/11/2026 ở commit `3518dac` (sau khi sửa lệch ngày UTC/giờ VN ở hạn dùng,
audit H1; thêm 6 test ở `backend/src/test/expiry-vietnam-day.test.ts`):

| Phần | File test | Test | Kết quả |
|---|---|---|---|
| Backend | 74 | 1.401 | tất cả đạt |
| Frontend | 38 | 522 | tất cả đạt |
| **Tổng** | **112** | **1.923** | **tất cả đạt** |

(Lần chạy 15/11/2026, commit `2ebc970`: backend 73 file / 1.395 test, frontend 38 / 522, tổng 1.917, tất cả đạt.)

(Lần chạy 12/11/2026, nhánh `ra-soat-cuoi`: backend 67 file / 1.248 test, frontend 33 / 507, tổng 1.755, tất cả đạt.)

Lỗi hạ tầng đã sửa (16/11/2026): từ 15/11, `npm test` ở backend kết thúc mã lỗi 1 dù 1.395/1.395 test đạt, vì Vitest báo
`[vitest-worker]: Timeout calling "onTaskUpdate"` (4/4 lần chạy). Nguyên nhân: ma trận an toàn gồm các test đồng bộ dài (cả file
50–100 giây), chạy liền nhau chỉ nhường microtask nên worker không kịp trả lời RPC báo tiến độ trong 60 giây. Sửa ở
`backend/src/test/setup.ts`: sau mỗi test nhường một nhịp vòng lặp sự kiện (`afterEach` + `setImmediate`); không xóa hay đổi test
nào. Sau khi sửa: 3 lần chạy liên tiếp đều thoát mã 0, mỗi lần 73 file / 1.395 test đạt (73–101 giây).

Kiểm thử trên ứng dụng thật (Playwright, Docker, cùng ngày, sau `demo:reset`), *đo thật*:

| Script | Kiểm gì | Kết quả |
|---|---|---|
| `demo-flow` | Đăng nhập → kho → quét hóa đơn chế độ dự phòng (ảnh hóa đơn dựng trong script, đọc được 3/3 dòng) → tạo thực đơn → đã ăn → báo cáo → gợi ý → tìm "com tron" → Admin (thống kê, tìm, bộ lọc Đã xóa) | 10/10 đạt |
| `landing-header-check` | Header trang chủ khi đã đăng nhập, tên 51 ký tự, 1024–1280px và 390px: không tràn ngang, cắt "…", không đè nút/menu | 31/31 đạt |

Lần chạy đầu `demo-flow` phát hiện lỗi thật: tạo thực đơn bằng OpenAI mất ~83 giây, nginx cắt ở 60 giây (504) dù thực đơn vẫn được
tạo. Đã sửa: OpenAI tối đa 120 giây rồi tự dùng bộ tạo dự phòng, nginx chờ 180 giây (lần đo sau: OpenAI quá 90 giây ở giới hạn cũ →
dự phòng, trả 201).

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

Hiệu năng gợi ý (`npm run test:perf -w backend`, *đo thật* trên máy dev): chạy lại 15/11/2026 ở commit `2ebc970`, 2/2 test đạt
ngưỡng < 150 ms cho một lần gợi ý với 33 món và với 500 món × 1.000 người dùng trong bộ nhớ. Lần nhanh nhất trong 5 lần (3 lần chạy):
33 món 3–6,5 ms; 500 món × 1.000 người 90–117 ms (lần đo 3/11: khoảng 70 ms).

## 2. Đánh giá bộ gợi ý — mô phỏng

Nguồn: `docs/thuat-toan-goi-y.md` mục 8, lệnh `npm run eval:recommend -w backend`.

Mã ở commit `3518dac`, chạy ngày 22/11/2026.

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

Cấu hình đang chạy trong mã (`hybrid.ts`, "for-you"): 0,45/0,30/0,25, w_pop0 = 0,4 — **khớp** cấu hình quy tắc chọn, nên bảng 1–2, 5 đo đúng cấu hình đang chạy.

Thời gian chạy: 21.3 s.

Lịch sử số liệu (bảng cũ ngày 3/11 → bảng mới, lý do đổi): `docs/thuat-toan-goi-y.md` mục 10.

## 3. Đánh giá bộ tạo thực đơn tuần — mô phỏng

Nguồn: `docs/thuat-toan-goi-y.md` mục 9, lệnh `npm run eval:mealplan -w backend`.

Mã ở commit `3518dac`, chạy ngày 22/11/2026.

Sinh bằng `npm run eval:mealplan -w backend`: 5 lần mô phỏng (seed 20261109–20261113), mỗi lần 100 người (500 thực đơn 7 ngày cho mỗi phương pháp). Hồ sơ ngẫu nhiên (5 chế độ ăn, 20% có một dị ứng, 10% có món không thích, 30% ăn 4 bữa), kho 8 thực phẩm (lượng 1–4 lần định lượng một món, hạn 0–10 ngày, 20% không có hạn), lịch sử 0–25 bữa đã ăn trong 4 tuần trước. Dữ liệu **mô phỏng**, chỉ trong bộ nhớ. Số trong bảng là trung bình trên mọi thực đơn.

| Phương pháp | Lệch calo ngày | Ngày lệch ≤ 10% | Lượng đồ sắp hết hạn dùng trước hạn | Đồ sắp hết hạn được dùng | Bữa lặp trong 3 ngày / thực đơn | Số món khác nhau | Vi phạm dị ứng/chế độ ăn | Bữa lấy món khác loại | Thời gian / thực đơn |
|---|---|---|---|---|---|---|---|---|---|
| Bộ tạo cũ (fallbackPlan) | 32,6% | 11,2% | 43,7% | 59,0% | 2,46 | 16,4 | 0,0% | 0,3% | 0,5 ms |
| Bộ tạo mới, không có khoảng calo (so sánh) | 28,1% | 17,0% | 58,4% | 73,5% | 1,72 | 16,5 | 0,0% | 0,3% | 9,4 ms |
| Bộ tạo mới (scoredPlan) **(dùng)** | 25,4% | 20,3% | 54,0% | 68,6% | 1,78 | 15,6 | 0,0% | 0,3% | 7,1 ms |
| OpenAI giả lập → reconcileAIPlan | 31,4% | 10,9% | 35,9% | 48,9% | 5,71 | 14,4 | 0,0% | 0,3% | 0,9 ms |

"Bữa lấy món khác loại": hồ sơ không còn món an toàn đúng loại bữa (chủ yếu chay/thuần chay kèm dị ứng gluten thiếu món trưa/tối) thì bộ tạo dùng món an toàn của bữa khác — an toàn trước, đúng bữa sau.

Giới hạn dưới của lệch calo ngày với bộ món hiện có (mỗi bữa chọn món chỉ theo calo, khẩu phần 1, bỏ mọi tiêu chí khác): 16,2%; mục tiêu calo trung bình của hồ sơ mô phỏng 2131 kcal/ngày.

"OpenAI giả lập": 6/500 thực đơn hỏng quá nửa số bữa nên dùng cả thực đơn của bộ tạo mới; còn lại bữa vi phạm được thay. Thời gian chạy: 12.0 s.

## 4. Tốc độ tải trang khi bật gzip — đo thật

Nguồn: `docs/test-evidence/2026-11-03_gd3b-l1_gzip.txt` (03/11/2026, trước các thay đổi giao diện sau đó).

GĐ3b lượt 1 — bật gzip ở nginx frontend (03/11/2026)
Đo bằng Playwright trên container frontend (nginx, bản build), cổng 8080, backend Docker; bộ nhớ đệm trống, trung vị 3 lần.
Điện thoại giả lập: mạng 1,6 Mb/s, độ trễ 150 ms, CPU chậm 4 lần. Dung lượng = tổng byte nhận về (JS, CSS, ảnh, phông, API).
Trước: cùng mã, chưa bật gzip (đo 03/11 khi nghiệm thu UI-12). Sau: bật gzip (HTML, JS, CSS, SVG, JSON kể cả API).
Tệp JS gói chính: 562.627 B gốc → 172.359 B khi nén (curl -H "Accept-Encoding: gzip").
Phần còn lại chủ yếu là phông (Google Fonts, woff2 vốn đã nén).

**Tách gói theo route (12/11/2026, rà soát cuối)** — `vite build`, *đo thật*: trước đó gói chính đã tăng lên 673,81 kB (gzip 204,98 kB,
vượt cảnh báo 500 kB của Vite). Chuyển mọi trang trừ Trang chủ và Đăng nhập sang tải khi mở (`React.lazy`): gói chính còn
**457,82 kB (gzip 145,81 kB)**, giảm 32%; Recharts (393,6 kB) chỉ tải ở Báo cáo và Admin. Bảng FCP/LCP trên đo trước thay đổi này.

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

Đếm lại ngày 15/11/2026 ở commit `3258f13` (mã giống `2ebc970`).

| Mục | Số lượng | Nguồn |
|---|---|---|
| Endpoint API | 87 (công khai 11, đăng nhập 54, Admin 22) | `docs/bao-cao/api.md` (sinh từ routes bằng `node scripts/docs/gen-api.mjs`) |
| Bảng CSDL / enum / quan hệ khóa ngoại | 32 / 19 / 39 (trong đó 9 bảng danh mục nghiệp vụ thêm ngày 14/11) | `docs/bao-cao/erd.md` (sinh từ `schema.prisma` bằng `node scripts/docs/gen-erd.mjs`) |
| Migration | 26 | `backend/prisma/migrations/` (đếm thư mục) |
| Món trong bộ seed | 33 | `backend/prisma/seed-data.ts` |
| Ảnh màn hình cho quyển | 29 màn hình (24 ở 1440px, 5 ở 390px), 30 tệp; chụp 12/11, cần chụp lại (`docs/bao-cao/quyen/danh-sach-anh.md`) | `docs/bao-cao/anh-man-hinh/README.md` |
| Use case | 26 khảo sát (15 đã làm, 11 làm khác; không làm phần "theo dõi thành viên") + 14 mới (UC27–UC40) | `docs/bao-cao/use-case.md` |

## 7. Dữ liệu mẫu cho demo — dữ liệu mẫu, không phải hoạt động thật

| Dữ liệu | Nội dung | Nguồn |
|---|---|---|
| Tài khoản mẫu | 8 tài khoản `mau1–8@nouri.vn`, 3 nhóm khẩu vị, có thực đơn đã ăn, bài viết, lượt thích; không tính vào thống kê Admin | `backend/prisma/sample-accounts.ts` |
| Lịch sử demo (gợi ý) | ~2 tuần: một thực đơn đã qua, 12 bữa đã ăn, 3 lượt thích | `backend/prisma/demo-history.ts` |
| Kho demo | 8 thực phẩm, hạn tính từ ngày chạy (Đậu hũ 1 ngày, Ức gà 2 ngày, …, Gạo 90 ngày) | `backend/prisma/demo-account.ts` |
| Báo cáo demo | 8 tuần lịch sử kho: món bỏ đi mỗi tuần 4, 4, 3, 3, 2, 2, 1, 1; số lần dùng trước hạn / số lần dùng 1/3, 2/4, 2/4, 3/5, 4/5, 5/6, 6/6, 3/3; thực đơn mẫu 6 ngày qua có 12 bữa đã ăn (bỏ trống 1 ngày) | `backend/prisma/demo-report.ts` |

Mọi dữ liệu mẫu được tạo lại bằng `demo:reset`; số trên trang Báo cáo của demo vì vậy là số dựng sẵn để minh họa xu hướng, không dùng
làm kết quả đánh giá.
