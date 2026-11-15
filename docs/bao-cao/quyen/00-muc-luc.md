# Quyển đồ án Nouri — Mục lục chi tiết (đã duyệt 15/11/2026)

Lập ngày 15/11/2026, đối chiếu mã trên `main` (commit `9c6077a`). Chưa viết nội dung. Nguồn ghi trong ngoặc vuông, bản cuối sẽ xóa.

**Giả định đã được duyệt (15/11/2026):**

| # | Việc | Đang giả định |
|---|---|---|
| G1 | Độ dài mục tiêu | Khoảng 75 trang nội dung (Mở đầu → Kết luận), không tính danh mục, tài liệu tham khảo, phụ lục — **đã duyệt** |
| G2 | Mẫu quyển của trường | Chưa có: dùng cấu trúc 5 chương — **đã duyệt** |
| G3 | Phiếu giao đề tài | Đã có nguyên văn: `docs/bao-cao/quyen/phieu-giao-de-tai.md`. `nouri-boi-canh-du-an.md` và bản nháp Chương 1–3 vẫn chưa đọc được (không bắt buộc) |

Ký hiệu điểm nhấn: **[ĐN1]** ba thuật toán gợi ý + bộ trộn + lọc an toàn; **[ĐN2]** vòng khép kín kho; **[ĐN3]** quét hóa đơn;
**[ĐN4]** an toàn dị ứng theo nhóm. Viết tắt nguồn: SL = `docs/bao-cao/so-lieu.md`, TT = `docs/thuat-toan-goi-y.md`,
GT = `docs/bao-cao/giai-thich-code-goi-y.md`, UC = `docs/bao-cao/use-case.md`, KT = `docs/bao-cao/kien-truc.md`, API = `docs/bao-cao/api.md`,
ERD = `docs/bao-cao/erd.md`, SQL = `docs/bao-cao/sql-mau.md`, AH = `docs/bao-cao/audit-hardcode.md`, HC = `docs/han-che.md`,
CH = `docs/cau-hoi-bao-ve.md`, RN = `REPORT_NOURI.md`, AMH = `docs/bao-cao/anh-man-hinh/README.md`, TE = `docs/test-evidence/`.

---

## A. Mục lục chi tiết

### Phần đầu (không tính trang nội dung)

| Mục | Ý chính | Nguồn |
|---|---|---|
| Tóm tắt (1 trang, tiếng Việt; thêm bản tiếng Anh nếu mẫu trường yêu cầu) | Bài toán, giải pháp (website Nouri), 4 đóng góp chính = 4 điểm nhấn, kết quả đo chính (ghi rõ "dữ liệu mô phỏng"), hạn chế chính | SL mục 1–3, HC |
| Danh mục hình | Theo mục C | — |
| Danh mục bảng | Theo mục C | — |
| Danh mục từ viết tắt và thuật ngữ | API, SPA, JWT, ORM, OCR, LLM, CF, TF-IDF, MMR, P@K, R@K, BMR, HSD, EXIF, CSDL, UC; thuật ngữ: khởi đầu lạnh, phản hồi ngầm, lọc an toàn, kho ảo, "có thể chứa" | TT, KT |

### Mở đầu (3 trang)

| Mục | Ý chính | Nguồn | Trang |
|---|---|---|---|
| 1. Lý do chọn đề tài | Lãng phí thực phẩm ở hộ gia đình; khó lập kế hoạch bữa ăn hợp dinh dưỡng, dị ứng; slogan "You are what you eat" | `phieu-giao-de-tai.md`; số liệu lãng phí thực phẩm từ tài liệu tham khảo [CẦN KIỂM TRA] | 1 |
| 2. Mục tiêu và kết quả dự kiến | Chép nguyên văn phiếu giao; ba việc giảng viên giao thêm | Phiếu giao | 0,5 |
| 3. Đối tượng, phạm vi | Website cho cá nhân/hộ gia đình; 33 món mẫu; không làm app di động gốc, không làm "theo dõi thành viên" | UC mục 1, HC 2.7 | 0,5 |
| 4. Phương pháp thực hiện | Khảo sát mã ban đầu → phát triển theo giai đoạn, mỗi thay đổi có test; đánh giá ngoại tuyến bằng mô phỏng | RN, `CLAUDE.md` (các giai đoạn), SL | 0,5 |
| 5. Bố cục quyển | Một đoạn mỗi chương | — | 0,5 |

### Chương 1. Tổng quan đề tài (8 trang)

| Mục | Ý chính | Nguồn | Hình/Bảng | Trang |
|---|---|---|---|---|
| **1.1 Bối cảnh và bài toán** | | | | 2 |
| 1.1.1 Lãng phí thực phẩm ở hộ gia đình | Nguyên nhân: quên hạn dùng, mua trùng, không biết nấu gì từ đồ sẵn có | Tài liệu tham khảo [CẦN KIỂM TRA] | — | 0,75 |
| 1.1.2 Lập kế hoạch bữa ăn và dinh dưỡng cá nhân | Mục tiêu calo/đạm, chế độ ăn, dị ứng; chi phí thời gian | Phiếu giao; CH câu 1 | — | 0,5 |
| 1.1.3 Phát biểu bài toán | Vòng khép kín: kho có hạn → gợi ý/thực đơn → ăn và mua tự cập nhật kho → báo cáo | CH câu 1, KT mục 3 | Hình 1.1 | 0,75 |
| **1.2 Khảo sát các giải pháp liên quan** | | | | 2 |
| 1.2.1 Ứng dụng quản lý kho và lập thực đơn hiện có | 3–4 ứng dụng tiêu biểu, chức năng công bố | [CẦN BỔ SUNG: chọn ứng dụng, trích từ trang chính thức; nguồn hiện có không có khảo sát này] | — | 1 |
| 1.2.2 So sánh và khoảng trống | Tiêu chí: hạn dùng, tự trừ kho, quét hóa đơn, lọc dị ứng theo nhóm, giải thích lý do gợi ý | như trên | Bảng 1.1 | 1 |
| **1.3 Mục tiêu, phạm vi và đóng góp** | | | | 2,5 |
| 1.3.1 Mục tiêu theo phiếu giao và yêu cầu giao thêm | Nguyên văn + 3 yêu cầu của giảng viên + nhận xét hardcode | Phiếu giao | — | 0,5 |
| 1.3.2 Bảng đối chiếu mục tiêu – nội dung quyển | Bảng B bên dưới | mục B | Bảng 1.2 | 1 |
| 1.3.3 Phạm vi, giới hạn | Website; 33 món, dinh dưỡng ước tính; đánh giá bằng dữ liệu mô phỏng; OCR chưa đo trên hóa đơn thật | HC mục 2, SL mục 5 | — | 0,5 |
| 1.3.4 Đóng góp của đề tài | Phần tự xây dựng (4 điểm nhấn) tách khỏi dịch vụ ngoài (OpenAI, Tesseract, Cloudinary, SMTP) | KT mục 1, 4 | Bảng 1.3 | 0,5 |
| **1.4 Hiện trạng ban đầu và quá trình thực hiện** | | | | 1,5 |
| 1.4.1 Hiện trạng mã khi khảo sát | 26 use case ứng viên, phần còn dở (AI một phần, nút giả) | RN mục 10–12 | — | 0,5 |
| 1.4.2 Các giai đoạn phát triển | Mốc chính; 26 UC khảo sát: 15 đã làm, 11 làm khác; UC mới UC27–UC40 | UC mục 1–2; `CLAUDE.md`; lịch sử git (18/8–15/11/2026) | Bảng 1.4 | 1 |

### Chương 2. Cơ sở lý thuyết và công nghệ (13 trang)

| Mục | Ý chính | Nguồn | Hình/Bảng | Trang |
|---|---|---|---|---|
| **2.1 Dinh dưỡng và an toàn thực phẩm** | | | | 1,5 |
| 2.1.1 Nhu cầu năng lượng: BMR Mifflin–St Jeor, hệ số vận động | Công thức đề tài dùng để tính chỉ tiêu cá nhân | CH câu 34, `services/nutrition.service.ts` [đọc lại code khi viết]; bài báo gốc [CẦN KIỂM TRA] | — | 0,5 |
| 2.1.2 Thành phần dinh dưỡng món ăn | Số liệu món là **ước tính**, tham khảo Bảng thành phần thực phẩm Việt Nam (2007) | HC 2.1 | — | 0,25 |
| 2.1.3 Dị ứng thực phẩm: nhóm chất gây dị ứng, thành phần ẩn, "có thể chứa" **[ĐN4]** | Vì sao so tên một chiều không đủ: tên gọi khác, gia vị chế biến, lây chéo | TT mục 2; tài liệu về nhóm dị ứng chính [CẦN KIỂM TRA] | — | 0,75 |
| **2.2 Hệ gợi ý [ĐN1]** | | | | 4 |
| 2.2.1 Bài toán gợi ý, phản hồi ngầm và phân loại | Nội dung, cộng tác, tri thức, lai; vị trí ba thuật toán của đề tài | TT mục 1; Burke 2002 | Hình 2.1 | 0,5 |
| 2.2.2 Lọc theo nội dung: TF-IDF, chuẩn hóa L2, cosine | Công thức idf, cosine theo khối đặc trưng | TT mục 3; GT mục 3 | — | 0,75 |
| 2.2.3 Lọc cộng tác theo món | Cosine cột món, co rút theo số người chung, k láng giềng, dự đoán | TT mục 4; Sarwar 2001; Deshpande–Karypis 2004 | Hình 2.2 | 0,75 |
| 2.2.4 Gợi ý dựa trên tri thức, tối ưu đa tiêu chí | Tổng có trọng số các hàm tiêu chí trong [0, 1]; ràng buộc cứng và mềm | TT mục 5 | — | 0,5 |
| 2.2.5 Hệ lai, khởi đầu lạnh, đa dạng hóa MMR | Trộn có trọng số, chuẩn hóa min–max, MMR | TT mục 6; Carbonell–Goldstein 1998 | — | 0,75 |
| 2.2.6 Đánh giá ngoại tuyến | P@K, R@K, độ phủ, đa dạng; chia theo thời gian; tập kiểm định/kiểm tra; giới hạn của mô phỏng | TT mục 8; Herlocker 2004 [CẦN KIỂM TRA] | Bảng 2.1 | 0,75 |
| **2.3 Trí tuệ nhân tạo trong đề tài** | | | | 2 |
| 2.3.1 Hai thành phần "AI" của Nouri | (a) hệ gợi ý do đề tài tự xây dựng, không huấn luyện mạng nơ-ron; (b) mô hình ngôn ngữ lớn gọi qua API. Nói rõ ranh giới | KT mục 1, 4; CH mục E | Bảng 2.2 | 0,75 |
| 2.3.2 Mô hình ngôn ngữ lớn qua API: đầu ra có cấu trúc, giới hạn | Responses API, structured output; rủi ro sai/chậm → luôn kiểm lại và có dự phòng | KT mục 4; CH câu 14, 14a, 24 | — | 0,75 |
| 2.3.3 Kiểm duyệt nội dung bằng AI | Moderation API; AI chỉ đánh dấu, không xóa | UC35, HC 1.3 | — | 0,5 |
| **2.4 Nhận dạng ký tự quang học cho hóa đơn [ĐN3]** | | | | 1,5 |
| 2.4.1 OCR truyền thống (Tesseract) | Chạy trên máy chủ, không cần mạng; yếu với giấy nhiệt, ảnh nghiêng | KT mục 4; HC 2.4; Smith 2007 | — | 0,5 |
| 2.4.2 Mô hình thị giác–ngôn ngữ đọc ảnh | Trả thẳng dòng hàng có cấu trúc; chi phí, phụ thuộc mạng, quyền riêng tư ảnh | KT 3.1; CH câu 17–20 | — | 0,5 |
| 2.4.3 Đặc thù hóa đơn bán lẻ Việt Nam | In không dấu, viết tắt, dòng không phải hàng (VAT, tổng, túi), quy cách × số lượng | `docs/ke-hoach-gd3c.md` mục 2–3 (chỉ dùng phần lý do; chi tiết theo code) | Hình 2.3 | 0,5 |
| **2.5 Công nghệ sử dụng** | | | | 3,5 |
| 2.5.1 Frontend: React 19, Vite, TypeScript, React Query 5, React Router 7 | Lý do chọn | KT mục 4 | Bảng 2.3 | 0,75 |
| 2.5.2 Backend: Express 5, Zod 3, Prisma 6, PostgreSQL 16 | route → controller → service; transaction, migration | KT mục 2, 4 | — | 0,75 |
| 2.5.3 Xác thực và bảo mật | Access token 15 phút + refresh token xoay vòng, bcrypt, helmet, rate limit | KT mục 4; UC01–03; TE `bao-mat.md` | — | 0,5 |
| 2.5.4 Dịch vụ ngoài (tùy chọn) | OpenAI, Cloudinary, SMTP, tesseract.js; thiếu thì hệ thống vẫn chạy | KT mục 1 | — | 0,5 |
| 2.5.5 Kiểm thử và triển khai | Vitest, Playwright, Docker Compose, nginx | KT mục 4; SL mục 1 | — | 0,5 |
| 2.5.6 Kết luận chương | | | | 0,5 |

### Chương 3. Phân tích và thiết kế hệ thống (21,5 trang)

| Mục | Ý chính | Nguồn | Hình/Bảng | Trang |
|---|---|---|---|---|
| **3.1 Phân tích yêu cầu** | | | | 4 |
| 3.1.1 Tác nhân | Khách, Người dùng, Admin, OpenAI, Cloudinary, SMTP, Bộ lập lịch | UC (đầu file) | Bảng 3.1 | 0,5 |
| 3.1.2 Yêu cầu chức năng theo nhóm | Tài khoản/hồ sơ; kho; công thức; thực đơn/đi chợ; gợi ý; AI; cộng đồng; báo cáo; Admin | UC mục 1–2 | Bảng 3.2; Hình 3.1–3.3 | 1,5 |
| 3.1.3 Đặc tả use case trọng tâm | UC27 gợi ý, UC28 tự cập nhật kho, UC29 quét hóa đơn, UC05 hồ sơ dị ứng, UC40 danh mục dữ liệu (mỗi UC một bảng đặc tả); các UC còn lại ở Phụ lục A | UC27–29, UC05, UC40 | Bảng 3.3–3.7 | 1,5 |
| 3.1.4 Yêu cầu phi chức năng | An toàn dị ứng (0 vi phạm sau lọc), dự phòng khi thiếu dịch vụ ngoài, hiệu năng gợi ý < 150 ms, bảo mật, dùng được trên điện thoại | SL mục 1; KT mục 1 | Bảng 3.8 | 0,5 |
| **3.2 Kiến trúc hệ thống** | | | | 2 |
| 3.2.1 Kiến trúc tổng thể và triển khai | 3 container; dịch vụ ngoài tùy chọn | KT mục 1 | Hình 3.4 | 1 |
| 3.2.2 Tổ chức mã theo lớp | Trang → thành phần → features; route → controller → service → Prisma | KT mục 2 | Bảng 3.9 | 0,5 |
| 3.2.3 Nguyên tắc dự phòng | Bảng: chức năng AI ↔ đường dự phòng | KT mục 1; CH câu 24 | Bảng 3.10 | 0,5 |
| **3.3 Thiết kế cơ sở dữ liệu** | | | | 2,5 |
| 3.3.1 Mô hình dữ liệu tổng quát | 32 bảng, 19 enum, 39 quan hệ khóa ngoại, chia 6 cụm | ERD (15/11) — **SL mục 6 đang ghi 23/16/33, xem mục D** | Hình 3.5; Bảng 3.11 | 1 |
| 3.3.2 Cụm kho – thực đơn – lịch sử **[ĐN2]** | `PantryItem`, `PantryTransaction` (nguồn, `reversalOfId`, `reversedAt`), `MealPlanItem`, `ShoppingItem`, `ReceiptScan` | ERD | Hình 3.6 | 0,75 |
| 3.3.3 Cụm danh mục nghiệp vụ trong CSDL **[ĐN4][ĐN3]** | Chuyển dữ liệu nghiệp vụ từ mã vào PostgreSQL theo nhận xét của giảng viên: `AllergenGroup/Alias/Term/Exclusion`, `FoodCategory/Term/ShelfLifeRule`, `ReceiptAbbreviation/SkipKeyword`; nạp vào bộ nhớ, nạp lại khi Admin sửa | AH mục C; ERD; SQL mục 1–4 | Hình 3.7; Bảng 3.12 | 0,75 |
| **3.4 Thiết kế lọc an toàn dị ứng theo nhóm [ĐN4]** | | | | 3 |
| 3.4.1 Bài toán và ví dụ lỗi | "trứng gà" không lọc được "Bánh mì ốp la"; nước tương chứa đậu nành + gluten; "cá" ≠ "cà chua", "chao" ≠ "cháo" | TT mục 2 | — | 0,5 |
| 3.4.2 Phương án đã cân nhắc | So chuỗi một chiều (cũ) / danh mục nhóm trong mã / danh mục trong CSDL có Admin quản lý; mã vạch nhãn hàng (để hướng phát triển) | TT mục 2; AH mục C; HC 2.2, mục 3 | Bảng 3.13 | 0,5 |
| 3.4.3 Danh mục 11 nhóm và quy tắc nhận nhóm | Chuẩn hóa mục nhập, nhận nhóm, không nhận ra vẫn lọc đúng chữ, gần đúng chỉ gợi ý | TT mục 2 (bảng quy tắc) | Hình 3.8; Bảng 3.14 | 0,75 |
| 3.4.4 Thành phần ẩn và mức "chứa" / "có thể chứa" | Bảng nguyên liệu chế biến → nhóm; ngoại lệ (bánh phở, mì chính, quả bơ) | TT mục 2 (bảng nguyên liệu chế biến) | Bảng 3.15 | 0,5 |
| 3.4.5 Dị ứng khác món không thích; một hàm dùng ở mọi nơi | Dị ứng lọc rộng, món không thích chỉ nguyên liệu chính; 8 nơi dùng chung `expandRestrictedTerms`/`findRestrictedTerms` | TT mục 2; CH câu 41 | Bảng 3.16 | 0,5 |
| 3.4.6 Trường hợp biên | Hồ sơ hẹp không còn món đúng bữa → món an toàn khác bữa; danh mục chưa nạp thì báo lỗi, không lọc với danh mục rỗng | TT mục 2, 9; AH mục C | — | 0,25 |
| **3.5 Thiết kế bộ gợi ý [ĐN1]** | | | | 5,5 |
| 3.5.1 Bài toán, ngữ cảnh gợi ý và phương án | 5 ngữ cảnh; vì sao không dùng phân rã ma trận/học sâu; vì sao lai | TT mục 1, 4, 6 | Hình 3.9; Bảng 3.17 | 0,5 |
| 3.5.2 Thuật toán 1 — lọc theo nội dung | 5 khối đặc trưng và trọng số; vector sở thích có suy giảm τ = 30 ngày; tiên nghiệm từ hồ sơ | TT mục 3; GT mục 3 | Bảng 3.18 | 1 |
| 3.5.3 Thuật toán 2 — lọc cộng tác theo món | r_ui, sim có co rút λ = 5, k = 20; ngưỡng 3 người; tránh vòng lặp phản hồi | TT mục 4; GT mục 4 | — | 1 |
| 3.5.4 Thuật toán 3 — dựa trên tri thức | 5 tiêu chí, công thức f_hạn, f_kho, f_dd, f_dạng, f_ưu; mục tiêu bữa E*, P* | TT mục 5; GT mục 5 | Bảng 3.19 | 1 |
| 3.5.5 Bộ trộn | Min–max, γ_u = n/(n+10), thành phần phổ biến w_pop0 = 0,4, MMR 0,8/0,2; trọng số theo ngữ cảnh; giả mã | TT mục 6; GT mục 6 | Hình 3.10; Bảng 3.20; Thuật toán 3.1 | 1 |
| 3.5.6 Sinh lý do gợi ý | Thành phần đóng góp lớn nhất → tiêu chí con; tránh lặp lý do | TT mục 6 bước 6; GT 6.6–6.7 | Bảng 3.21 | 0,5 |
| 3.5.7 Bộ tạo thực đơn tuần dùng lại bộ gợi ý | S = s3 + 0,3·s1 − 0,1·số lần; kho ảo; ràng buộc cứng; kiểm lại kết quả OpenAI (`reconcileAIPlan`) | TT mục 9; UC09 | Hình 3.11 | 0,5 |
| **3.6 Thiết kế vòng khép kín kho [ĐN2]** | | | | 3,5 |
| 3.6.1 Bài toán và vì sao khó | Kho chỉ đúng khi được cập nhật; khớp tên nguyên liệu–thực phẩm, đơn vị khác nhau, nhiều lô cùng tên khác hạn, thao tác đồng thời, hoàn tác | UC28; KT 3.2 | — | 0,5 |
| 3.6.2 Phương án đã cân nhắc | Người dùng tự sửa tay / tự trừ không hỏi / tự trừ có xem trước và chỉnh (chọn) | UC12; TE `2026-11-03_gd3b-l3_tru-kho.txt` | Bảng 3.22 | 0,25 |
| 3.6.3 "Đã ăn" → trừ kho | Lượng = SL × khẩu phần bữa / khẩu phần món; hạn sớm trước; không trừ đồ hết hạn; quy đổi g↔kg, ml↔l; trạng thái từng nguyên liệu (ENOUGH, EXPIRED_ONLY, NOT_IN_PANTRY…) | KT 3.2; CH câu 15; TE tru-kho | Hình 3.12, 3.13; Thuật toán 3.2 | 1 |
| 3.6.4 "Đã mua" và quét hóa đơn → cộng kho | Gộp / dùng lại món "Đã dùng hết" / tạo mới; hạn ước tính theo nhóm và hạn riêng theo loại | UC13, UC28; AH mục C; SQL mục 4 | Hình 3.14; Bảng 3.23 | 0,75 |
| 3.6.5 Lịch sử kho và hoàn tác | Mọi thay đổi ghi `PantryTransaction` cùng transaction; hoàn tác trỏ `reversalOfId`, không hoàn hai lần; xóa phải chọn lý do | UC06; CH câu 16; SQL mục 6 | Bảng 3.24 | 0,5 |
| 3.6.6 Đồng thời và trường hợp biên | `updateMany` có điều kiện số lượng cũ; thực phẩm đã xóa không tạo lại khi hoàn tác; về 0 vẫn giữ | CH câu 16; TE tru-kho | — | 0,5 |
| **3.7 Thiết kế quét hóa đơn [ĐN3]** | | | | 3 |
| 3.7.1 Bài toán và phương án | Nhập tay chậm; ba chế độ Tự động / Đọc bằng AI / Dự phòng; vì sao cần cả hai và màn duyệt bắt buộc | UC29; CH câu 17–19 | Bảng 3.25 | 0,5 |
| 3.7.2 Luồng xử lý và trạng thái | Tải ảnh → làm sạch → đọc nền → phân tích → duyệt → lưu một lô → hoàn tác | KT 3.1; API (nhóm `/api/pantry/receipt-scans`) | Hình 3.15, 3.16 | 0,75 |
| 3.7.3 Bộ phân tích dòng (tự xây) | Ghép dòng, mẫu số lượng/giá, đơn vị, quy cách × số hộp, từ khóa bỏ dòng (trong CSDL) | `backend/src/services/receipt/receipt-parser.ts` + test [đọc code khi viết] | Hình 3.17; Bảng 3.26 | 0,75 |
| 3.7.4 Bộ chuẩn hóa (tự xây) | Tên không dấu/viết tắt → tên chuẩn theo kho, bộ món, bảng viết tắt; nhóm, hạn ước tính, đích trong kho, nhãn dị ứng | `receipt-normalize.ts`, `receipt-catalog.ts` [đọc code khi viết] | Bảng 3.27 | 0,5 |
| 3.7.5 Giới hạn, quyền riêng tư, trường hợp biên | 10 lượt/ngày, ảnh ≤ 5 MB, xóa EXIF, không lưu ảnh, nháp 30 phút, lưu một lần, AI lỗi → Tesseract | UC29; CH câu 18, 20 | — | 0,5 |
| **3.8 Thiết kế các chức năng còn lại (mỗi chức năng 0,5 trang)** | | | | 2 |
| 3.8.1 Xác thực, phân quyền | Access + refresh xoay vòng, khóa tài khoản, quên mật khẩu | UC01–03, UC32–33 | Hình 3.18 | 0,5 |
| 3.8.2 Trợ lý AI và kiểm duyệt | Ngữ cảnh gửi đi, hai lớp chống gợi ý dị ứng, giới hạn 30 câu/ngày | CH câu 22–25; HC 1.3 | — | 0,5 |
| 3.8.3 Báo cáo lãng phí và dinh dưỡng; nhắc hạn email | Cách tính từ lịch sử kho; lịch 07:00, khóa chống gửi trùng | UC30–31; CH câu 21 | — | 0,5 |
| 3.8.4 Cộng đồng và khu Admin | Bài viết, công thức thành viên; nhật ký `AdminAuditLog` cùng transaction | UC19–26, UC34–38 | — | 0,5 |

### Chương 4. Cài đặt và kết quả (14 trang)

| Mục | Ý chính | Nguồn | Hình/Bảng | Trang |
|---|---|---|---|---|
| **4.1 Môi trường và triển khai** | Docker Compose 3 dịch vụ, migration tự chạy khi khởi động, biến môi trường; quy mô mã | KT mục 1; `README.md`; SL mục 6 (sau khi cập nhật) | Bảng 4.1, 4.2 | 1,5 |
| **4.2 Cài đặt bộ gợi ý [ĐN1]** | | | | 2 |
| 4.2.1 Cấu trúc module và luồng `runRecommendation` | 5 bước, file và dòng theo commit `2ebc970` | GT mục 1, bảng tra nhanh | Bảng 4.3 | 0,5 |
| 4.2.2 Các hàm chính của ba thuật toán | Trích đoạn mã ngắn: TF-IDF, sim có co rút, f_hạn | GT mục 3–5 | Đoạn mã 4.1–4.3 | 0,75 |
| 4.2.3 Bộ trộn, tham số đang chạy | `CONTEXT_WEIGHTS`, `POPULARITY_WEIGHT0 = 0,4`, MMR | GT mục 6 | Đoạn mã 4.4 | 0,25 |
| 4.2.4 Kết quả trên giao diện | "Gợi ý cho bạn", "Dành cho bạn", "Nấu gì từ kho", "Món tương tự", lý do | AMH 10, 15, 17 | Hình 4.1–4.3 | 0,5 |
| **4.3 Cài đặt lọc an toàn dị ứng [ĐN4]** | | | | 1,5 |
| 4.3.1 Dịch vụ danh mục và hàm lọc | `services/catalog/`, `dietary.service.ts`, `safety.ts`, `recipe-fit.service.ts` | GT mục 2; AH mục C | Bảng 4.4 | 0,75 |
| 4.3.2 Giao diện hồ sơ, nhãn món, Admin danh mục | Ô gợi ý dị ứng, "Sẽ tránh", "Chứa: …", trang Danh mục dữ liệu | UC05, UC07, UC40 | Hình 4.4–4.6 [CẦN CHỤP] | 0,75 |
| **4.4 Cài đặt vòng khép kín kho [ĐN2]** | | | | 2 |
| 4.4.1 Dịch vụ trừ/cộng kho | `meal-consumption.service.ts`, `services/pantry-consumption.ts`, `pantry-intake.ts`, `pantry-purchase.ts`, `pantry-match.ts` | UC28; KT 3.2 | Bảng 4.5; Đoạn mã 4.5 | 1 |
| 4.4.2 Giao diện Kho, xem trước "Đã ăn", lịch sử, hoàn tác | | AMH 11, 12, 14 | Hình 4.7–4.9 (hộp xem trước [CẦN CHỤP]) | 1 |
| **4.5 Cài đặt quét hóa đơn [ĐN3]** | | | | 2 |
| 4.5.1 Nhà cung cấp OCR và công việc nền | `services/receipt/providers/`, `receipt-scan.jobs.ts`, `receipt-scan.service.ts` | KT 3.1; code | Bảng 4.6 | 1 |
| 4.5.2 Giao diện quét và màn duyệt | Chọn chế độ, tiến trình, sửa/bỏ dòng, hoàn tác hóa đơn | AMH 13 | Hình 4.10, 4.11 (màn duyệt [CẦN CHỤP]) | 1 |
| **4.6 Các chức năng khác (0,5–1 trang mỗi chức năng)** | | | | 4 |
| 4.6.1 Tài khoản và hồ sơ dinh dưỡng | | AMH 02–04, 22 | Hình 4.12 | 0,5 |
| 4.6.2 Thực đơn tuần và danh sách đi chợ | Mặc định thuật toán, "Tạo bằng AI" chạy nền | UC09–15, UC39; AMH 14 | Hình 4.13 | 0,75 |
| 4.6.3 Công thức, tìm kiếm không dấu, yêu thích | | UC07–08, UC24; AMH 15–18 | Hình 4.14 | 0,5 |
| 4.6.4 Trợ lý AI "Hỏi Nouri" | | UC16–17; AMH 20 | Hình 4.15 | 0,5 |
| 4.6.5 Báo cáo và nhắc hạn | Ảnh dùng **dữ liệu mẫu** | UC30–31; AMH 21; SL mục 7 | Hình 4.16 | 0,5 |
| 4.6.6 Cộng đồng | | UC19–26, UC34–35; AMH 19 | Hình 4.17 | 0,5 |
| 4.6.7 Khu Admin | Thống kê, công thức, người dùng, kiểm duyệt, nhật ký, danh mục | UC36–38, UC40; AMH 40–45 | Hình 4.18 | 0,75 |
| **4.7 Giao diện trên điện thoại** | 390 px | AMH 30–34 | Hình 4.19 | 0,5 |
| **4.8 Kết luận chương** | | | | 0,5 |

### Chương 5. Thực nghiệm và đánh giá (12 trang)

| Mục | Ý chính | Nguồn | Hình/Bảng | Trang |
|---|---|---|---|---|
| **5.1 Kiểm thử tự động** | 111 file, 1.917 test, tất cả đạt (15/11/2026, commit `2ebc970`); cách giả lập Prisma/OpenAI/đồng hồ; kiểm thử trên ứng dụng thật (`demo-flow` 10/10) | SL mục 1 | Bảng 5.1, 5.2 | 1,5 |
| **5.2 Đánh giá bộ gợi ý trên dữ liệu mô phỏng [ĐN1]** | | | | 3,5 |
| 5.2.1 Thiết lập | 5 lần × 80 người × 28 ngày, 6 nhóm khẩu vị, 1488 tương tác/lần; chia tập; phương án cơ sở (ngẫu nhiên, phổ biến nhất) | SL mục 2 | Bảng 5.3 | 0,5 |
| 5.2.2 Chọn tham số trên tập kiểm định | Bảng 3, 4 của SL; quy tắc đặt trước; không dùng tập kiểm tra | SL mục 2 bảng 3, 4 | Bảng 5.4, 5.5 | 0,5 |
| 5.2.3 Kết quả trên tập kiểm tra | Bảng 1 của SL; R@10 bộ trộn + phổ biến 0,671 | SL mục 2 bảng 1 | Bảng 5.6; Hình 5.1 | 0,75 |
| 5.2.4 Khởi đầu lạnh | Bảng 2, 5: nhóm 0 tương tác 0,386 → 0,614 | SL mục 2 bảng 2, 5 | Bảng 5.7; Hình 5.2 | 0,5 |
| 5.2.5 Đánh đổi độ đúng – mục tiêu sản phẩm | Lệch calo, tỷ lệ danh sách có đồ sắp hết hạn; vì sao không chỉ dùng thuật toán 1 | TT mục 8 nhận xét | Hình 5.3 | 0,5 |
| 5.2.6 Sự cố số liệu và cách xử lý | Sửa lỗi thành phần ẩn (`b8bc55a`) làm đổi dữ liệu mô phỏng 1544 → 1488 → chạy lại, chọn lại tham số theo đúng quy tắc (`2ebc970`) | TT mục 10 | Bảng 5.8 | 0,25 |
| 5.2.7 Hiệu năng | 33 món 3–6,5 ms; 500 món × 1.000 người 90–117 ms, ngưỡng 150 ms (đo thật, máy dev) | SL mục 1 | — | 0,25 |
| 5.2.8 Hạn chế của đánh giá | Thiên vị thuật toán 1, bộ món nhỏ, rò rỉ nhẹ theo thời gian, không có người dùng thật | TT mục 8 hạn chế | — | 0,25 |
| **5.3 Đánh giá bộ tạo thực đơn tuần (dữ liệu mô phỏng)** | 500 thực đơn; lệch calo 32,6% → 25,4%; đồ sắp hết hạn dùng trước hạn 43,7% → 54,0%; ràng buộc ±35%; giới hạn dưới 16,2%; lỗi thật nginx 504 khi OpenAI > 60 s | SL mục 3, mục 1; TT mục 9 | Bảng 5.9; Hình 5.4 | 1,5 |
| **5.4 Kiểm thử an toàn dị ứng [ĐN4]** | | | | 1,5 |
| 5.4.1 Ma trận an toàn | 105 hồ sơ × mọi nguồn gợi ý/thực đơn + 14 cách gõ; 0 vi phạm; đối chứng không lọc 13,5% | SL mục 1, 2; TT mục 2 | Bảng 5.10 | 0,75 |
| 5.4.2 Lỗi thật đã phát hiện và sửa | "trứng gà" (13/11), thành phần ẩn nước tương (13/11); hệ quả: hồ sơ thuần chay + gluten, 0,3% bữa lấy món khác loại | TT mục 2, 9, 10 | Bảng 5.11 | 0,75 |
| **5.5 Kiểm thử vòng khép kín kho [ĐN2]** | Kịch bản trên Docker qua API: 14/14 và 6/6 đạt (trừ theo hạn sớm, quy đổi kg, không trừ hai lần, hoàn tác, thực phẩm đã xóa); test đơn vị `pantry-consumption.test.ts`, `pantry-purchase.test.ts` | TE `2026-11-03_gd3b-l3_tru-kho.txt`, `…l2_lich-su-kho.txt` | Bảng 5.12 | 1,5 |
| **5.6 Kiểm thử quét hóa đơn [ĐN3]** | Test bộ phân tích/chuẩn hóa bằng dữ liệu giả lập; `demo-flow` đọc 3/3 dòng ảnh dựng trong script; **chưa có số đo trên hóa đơn thật** → [CẦN BỔ SUNG] | SL mục 1, 5; HC 2.4 | Bảng 5.13 (để trống chờ số) | 1 |
| **5.7 Hiệu năng tải trang và bảo mật** | gzip: FCP trang chủ điện thoại giả lập 5,14 s → 2,20 s; gói chính 673,81 → 457,82 kB; kiểm thử phiên/quên mật khẩu | SL mục 4; TE `bao-mat.md` | Bảng 5.14; Hình 5.5 | 1 |
| **5.8 Đánh giá mức độ đáp ứng mục tiêu** | Nhắc lại Bảng 1.2 kèm số liệu của chương này | mục B | Bảng 5.15 | 0,5 |
| **5.9 Kết luận chương** | | | | 0,5 |

### Kết luận và hướng phát triển (3 trang)

| Mục | Ý chính | Nguồn | Trang |
|---|---|---|---|
| 1. Kết quả đạt được | 4 điểm nhấn + hệ thống hoàn chỉnh; mức độ hoàn thành từng mục tiêu (Bảng 1.2) | Chương 5 | 1 |
| 2. Hạn chế | Dữ liệu mô phỏng, 33 món, dinh dưỡng ước tính, OCR chưa đo thật, dị ứng theo tên, một tiến trình | HC mục 1–2 | 1 |
| 3. Hướng phát triển | Đánh giá với người dùng thật, OCR trên ≥ 10 hóa đơn, dị ứng theo nhãn hàng, khẩu phần theo mục tiêu, Redis, web push | HC mục 3 | 1 |

### Tài liệu tham khảo (dự kiến; mọi mục phải kiểm lại bản gốc trước khi in)

1. Viện Dinh dưỡng, *Bảng thành phần thực phẩm Việt Nam*, NXB Y học, 2007. [HC 2.1]
2. Deshpande M., Karypis G., "Item-based top-N recommendation algorithms", *ACM TOIS* 22(1), 2004. [TT mục 4 nêu tên]
3. Sarwar B. và cộng sự, "Item-based collaborative filtering recommendation algorithms", WWW 2001. [CẦN KIỂM TRA]
4. Carbonell J., Goldstein J., "The use of MMR, diversity-based reranking for reordering documents and producing summaries", SIGIR 1998. [CẦN KIỂM TRA]
5. Burke R., "Hybrid recommender systems: survey and experiments", *UMUAI* 12(4), 2002. [CẦN KIỂM TRA]
6. Salton G., Buckley C., "Term-weighting approaches in automatic text retrieval", *IP&M* 24(5), 1988. [CẦN KIỂM TRA]
7. Hu Y., Koren Y., Volinsky C., "Collaborative filtering for implicit feedback datasets", ICDM 2008. [CẦN KIỂM TRA]
8. Herlocker J. và cộng sự, "Evaluating collaborative filtering recommender systems", *ACM TOIS* 22(1), 2004. [CẦN KIỂM TRA]
9. Ricci F., Rokach L., Shapira B. (chủ biên), *Recommender Systems Handbook*, Springer. [CẦN KIỂM TRA năm, lần xuất bản]
10. Mifflin M. D. và cộng sự, "A new predictive equation for resting energy expenditure in healthy individuals", *AJCN* 51(2), 1990. [CẦN KIỂM TRA]
11. Smith R., "An overview of the Tesseract OCR engine", ICDAR 2007. [CẦN KIỂM TRA]
12. UNEP, *Food Waste Index Report*. [CẦN KIỂM TRA năm và số liệu trích]
13. Tài liệu chính thức: React, Express, Prisma, PostgreSQL, OpenAI API, tesseract.js (ghi ngày truy cập). [CẦN BỔ SUNG URL]
14. Tài liệu về các nhóm chất gây dị ứng thực phẩm chính (Codex/FDA/Bộ Y tế). [CẦN BỔ SUNG, CẦN KIỂM TRA]

### Phụ lục

| Phụ lục | Nội dung | Nguồn |
|---|---|---|
| A | Bảng đối chiếu 40 use case (UC01–UC40) | UC |
| B | Danh sách API (87 endpoint) | API |
| C | Mô tả các bảng CSDL và ERD đầy đủ | ERD |
| D | Câu SQL mẫu trên danh mục, kho, lãng phí | SQL |
| E | Bảng nguyên liệu chế biến → nhóm dị ứng đầy đủ; danh sách 105 hồ sơ của ma trận | TT mục 2; `dietary-matrix.test.ts` |
| F | Bảng số liệu đầy đủ của đánh giá gợi ý (P@5, R@5, độ phủ) và thực đơn | SL mục 2–3 |
| G | Bảng tra file:dòng của bộ gợi ý (commit `2ebc970`) | GT bảng tra nhanh |
| H | Hướng dẫn cài đặt, chạy, tài khoản demo | `README.md` |

**Tổng trang nội dung:** Mở đầu 3 + C1 8 + C2 13 + C3 21,5 + C4 14 + C5 12 + Kết luận 3 = **74,5**.

**Phân bổ điểm nhấn:**

| Điểm nhấn | Mục (trang) | Tổng | Yêu cầu |
|---|---|---|---|
| ĐN1 | 2.2 (4) + 3.5 (5,5) + 4.2 (2) + 5.2 (3,5) | 15 | 12–15 |
| ĐN2 | 3.3.2 (0,75) + 3.6 (3,5) + 4.4 (2) + 5.5 (1,5) | 7,75 | 6–8 |
| ĐN3 | 2.4 (1,5) + 3.7 (3) + 4.5 (2) + 5.6 (1) | 7,5 | 6–8 |
| ĐN4 | 2.1.3 (0,75) + 3.4 (3) + 4.3 (1,5) + 5.4 (1,5) | 6,75 | 5–6 (dư 0,75; rút Bảng 3.15 xuống Phụ lục E nếu cần) |

**Sáu nội dung bắt buộc của mỗi điểm nhấn nằm ở đâu:**

| | a) Bài toán, vì sao khó | b) Phương án | c) Thiết kế | d) Cài đặt | e) Kiểm thử, lỗi thật | f) Hạn chế, hướng phát triển |
|---|---|---|---|---|---|---|
| ĐN1 | 3.5.1 | 3.5.1, 2.2 | 3.5.2–3.5.7 | 4.2 | 5.2, 5.3 (lỗi: số liệu lệch sau `b8bc55a`, nginx 504) | 5.2.8, Kết luận |
| ĐN2 | 3.6.1 | 3.6.2 | 3.6.3–3.6.6, 3.3.2 | 4.4 | 5.5 ([CẦN BỔ SUNG: lỗi thật của luồng kho, tra `docs/lich-su-giai-doan.md`]) | Kết luận (báo cáo đếm theo lần, không theo khối lượng) |
| ĐN3 | 3.7.1, 2.4.3 | 3.7.1, 2.4 | 3.7.2–3.7.5 | 4.5 | 5.6 ([CẦN BỔ SUNG: số đo thật và lỗi thật]) | Kết luận, HC 2.4 |
| ĐN4 | 3.4.1 | 3.4.2 | 3.4.3–3.4.6, 3.3.3 | 4.3 | 5.4 (lỗi "trứng gà", nước tương) | Kết luận, HC 2.2 |

---

## B. Bảng đối chiếu mục tiêu (sẽ là Bảng 1.2, nhắc lại ở 5.8 và Kết luận)

Cột "Nguyên văn phiếu giao" trích đúng chữ từ `docs/bao-cao/quyen/phieu-giao-de-tai.md`. MT = ý trong "Mục tiêu đề tài", KQ = "Kết quả dự
kiến", GT = giảng viên giao thêm. Cột cuối ghi **mức chứng minh được** để quyển không khẳng định quá bằng chứng.

| # | Nguyên văn phiếu giao | Mục chứng minh | Bằng chứng (chức năng) | Bằng chứng (số liệu) | Mức chứng minh được |
|---|---|---|---|---|---|
| MT1 | "giảm lãng phí thực phẩm" | 3.5.4, 3.6, 4.4, 5.2.5, 5.3 | Kho có hạn dùng, tiêu chí f_hạn trọng số lớn nhất (0,35), ngữ cảnh "Nấu gì từ kho", nhắc hạn email, báo cáo lãng phí | Mô phỏng: 82,3% danh sách gợi ý có món dùng đồ sắp hết hạn (ngẫu nhiên 61,7%); thực đơn dùng 54,0% lượng đồ sắp hết hạn trước hạn (bộ cũ 43,7%) [SL mục 2, 3] | Chứng minh **cơ chế** và số mô phỏng; **chưa đo** mức giảm lãng phí ở người dùng thật |
| MT2 | "tiết kiệm thời gian lên kế hoạch nấu ăn" | 3.5.7, 3.6, 3.7, 4.4–4.6.2 | Thực đơn 7 ngày tạo ngay bằng thuật toán, danh sách đi chợ, tự trừ/cộng kho, quét hóa đơn thay nhập tay | Tạo một thực đơn 8,4 ms (mô phỏng, chưa gồm ghi CSDL) [SL mục 3] | Có thời gian máy; **không có** số đo thời gian người dùng tiết kiệm [CẦN BỔ SUNG nếu muốn khẳng định] |
| MT3 | "hỗ trợ người dùng xây dựng chế độ ăn phù hợp" | 2.1, 3.4, 3.5.4, 4.6.1 | Hồ sơ: chế độ ăn, dị ứng, món không thích, chỉ tiêu calo/đạm; lọc an toàn trước mọi gợi ý | Ma trận 105 hồ sơ: 0 món vi phạm; mô phỏng 0,0% vi phạm sau lọc, 13,5% khi không lọc [SL mục 1, 2] | Chứng minh được |
| MT4 | "kết hợp giữa ứng dụng trên công nghệ Web và trí tuệ nhân tạo" | 2.3, 3.2, 4.1 | SPA React + API Express + PostgreSQL; hệ gợi ý tự xây + mô hình ngôn ngữ lớn qua API, có dự phòng | Quy mô hệ thống [SL mục 6] | Đạt; phải trình bày đúng hai thành phần "AI" (mục E2 câu 1) |
| MT5 | "hương vị món ăn phù hợp tham chiếu của người sử dụng"; slogan "You are what you eat." | 3.5.2, 3.4.5, Mở đầu | Ẩm thực ưa thích, món không thích trong hồ sơ; thuật toán 1 học từ món đã ăn/thích; lý do gợi ý "Có nguyên liệu bạn hay dùng" | Mô phỏng: R@10 thuật toán 1 là 0,651; > 5 tương tác 0,711 [SL mục 2] | **Gián tiếp**: không mô hình hóa vị (cay, ngọt…), chưa có đánh giá của người dùng thật (mục E2 câu 3) |
| KQ1 | "Sản phẩm hoàn thiện lập kế hoạch nấu ăn, hỗ trợ người sử dụng, để đảm bảo dinh dưỡng hợp lý." | 3.5.7, 4.6.2, 5.3, 4.6.5 | Thực đơn 7 ngày, danh sách đi chợ, chỉnh món, đánh dấu đã ăn, báo cáo dinh dưỡng tuần; ràng buộc calo ±35% mỗi bữa | Mô phỏng: lệch calo ngày 32,6% → 25,4%; giới hạn dưới của bộ món 16,2% [SL mục 3] | Đạt chức năng; "đảm bảo" nên viết là "hỗ trợ đạt": lệch calo còn 25,4%, dinh dưỡng món là ước tính |
| KQ2 | "Ứng dụng dựa trên thuật toán gợi ý để lập kế hoạch dinh dưỡng, phù hợp với nhu cầu sự tham chiếu của người sử dụng." | 2.2, 3.5, 4.2, 5.2, 5.3 | Ba thuật toán + bộ trộn + lý do gợi ý, 5 ngữ cảnh; bộ tạo thực đơn dùng lại thuật toán 3 và 1 | Mô phỏng: R@10 0,671 so với ngẫu nhiên 0,377, phổ biến nhất 0,608 [SL mục 2 bảng 1] | Chứng minh được trên dữ liệu mô phỏng |
| KQ3 | "Hỗ trợ tính năng thông tin từ AI, đảm bảo chức năng cân bằng dinh dưỡng, mang đến sự hài lòng về thực phẩm cũng như hương vị sử dụng, phù hợp với từng người dùng." | 2.3, 3.8.2, 4.6.4, 3.5.7 | Trợ lý nhận hồ sơ rút gọn, kho, thực đơn của từng người; thực đơn AI kiểm lại qua lọc an toàn; cảnh báo dị ứng dưới câu trả lời | 0,0% bữa vi phạm dị ứng/chế độ ăn sau `reconcileAIPlan` (mô phỏng, OpenAI giả lập) [SL mục 3] | Chứng minh cơ chế cá nhân hóa và an toàn; chất lượng câu trả lời và "sự hài lòng" **không được đo** |
| GT1 | Tự cập nhật kho khi tiêu thụ nguyên liệu | 3.6, 4.4, 5.5 | "Đã ăn" trừ kho, hoàn tác | Kịch bản Docker 14/14 và 6/6 đạt [TE] | Đạt |
| GT2 | Nhập thực phẩm bằng quét hóa đơn | 3.7, 4.5, 5.6 | Hai cách đọc, bộ phân tích/chuẩn hóa tự xây, màn duyệt, hoàn tác | Chỉ có test dữ liệu giả lập; **chưa có** tỉ lệ đúng trên hóa đơn thật | Đạt chức năng; thiếu số đo |
| GT3 | Ba thuật toán gợi ý ở backend | như KQ2 | `backend/src/modules/recommendation/` | như KQ2 | Đạt |
| GT4 | Dữ liệu nghiệp vụ không viết cứng trong mã | 3.3.3, 4.3, Phụ lục D | 9 bảng danh mục, trang Admin "Danh mục dữ liệu" (UC40), nhật ký thao tác | Đánh giá ra đúng từng số trước/sau khi chuyển [AH mục C] | Đạt |

Ba chữ trong phiếu quyển **không được lặp lại như khẳng định**: "đảm bảo dinh dưỡng hợp lý", "đảm bảo chức năng cân bằng dinh dưỡng",
"sự hài lòng về … hương vị". Quyển viết là hệ thống *hỗ trợ* và nêu số đo được; phần chưa đo ghi ở Hạn chế.

---

## C. Danh sách hình và bảng dự kiến

### Hình

| Số | Tên | Loại | Trạng thái |
|---|---|---|---|
| 1.1 | Vòng khép kín của Nouri: kho → gợi ý → thực đơn → ăn/mua → kho → báo cáo | Sơ đồ luồng | Cần vẽ |
| 2.1 | Phân loại hệ gợi ý và vị trí ba thuật toán của đề tài | Sơ đồ | Cần vẽ |
| 2.2 | Ma trận người dùng – món và độ tương đồng giữa hai cột món | Minh họa | Cần vẽ |
| 2.3 | Một hóa đơn siêu thị và các loại dòng (hàng, tổng, thuế, túi) | Minh họa (ảnh dựng) | Cần vẽ |
| 3.1 | Use case tổng quát | Use case | Cần vẽ (UC) |
| 3.2 | Use case nhóm kho – thực đơn – gợi ý (Người dùng) | Use case | Cần vẽ |
| 3.3 | Use case khu Admin | Use case | Cần vẽ |
| 3.4 | Kiến trúc tổng thể và triển khai | Kiến trúc | Có mermaid ở KT mục 1 |
| 3.5 | ERD tổng quát theo 6 cụm (rút gọn, chỉ khóa) | ERD | Rút từ ERD |
| 3.6 | ERD cụm kho – thực đơn – lịch sử | ERD | Rút từ ERD |
| 3.7 | ERD cụm danh mục dị ứng, nhóm thực phẩm, hóa đơn | ERD | Rút từ ERD |
| 3.8 | Lưu đồ nhận nhóm dị ứng từ mục người dùng nhập | Lưu đồ | Cần vẽ (TT mục 2) |
| 3.9 | Luồng xử lý một yêu cầu gợi ý | Lưu đồ | Có mermaid ở KT 3.3 |
| 3.10 | Trọng số bộ trộn theo số món đã tương tác (γ_u, w_pop) | Đồ thị | Cần vẽ từ công thức |
| 3.11 | Luồng tạo thực đơn: thuật toán mặc định, AI chạy nền, kiểm lại | Lưu đồ | Cần vẽ (UC09) |
| 3.12 | Sơ đồ tuần tự "Đã ăn" → trừ kho | Tuần tự | Có mermaid ở KT 3.2 |
| 3.13 | Ví dụ trừ theo hạn sớm trước (Hành tím 6 g + 4 g) | Minh họa | Cần vẽ (TE tru-kho) |
| 3.14 | Lưu đồ chọn đích khi cộng kho: gộp / dùng lại / tạo mới | Lưu đồ | Cần vẽ |
| 3.15 | Sơ đồ tuần tự quét hóa đơn → kho | Tuần tự | Có mermaid ở KT 3.1 |
| 3.16 | Sơ đồ trạng thái một lượt quét | Trạng thái | Cần vẽ (API, code) |
| 3.17 | Đường ống bộ phân tích và chuẩn hóa dòng hóa đơn | Luồng | Cần vẽ |
| 3.18 | Sơ đồ tuần tự đăng nhập và làm mới token | Tuần tự | Cần vẽ |
| 4.1 | Tổng quan: "Gợi ý cho bạn" kèm lý do | Ảnh `10-tong-quan` | Có |
| 4.2 | Công thức: "Dành cho bạn" | Ảnh `15-cong-thuc` | Có (chụp lại sau khi đổi tham số) |
| 4.3 | Chi tiết món: món tương tự, người khác cũng nấu | Ảnh `17-chi-tiet-mon` | Có |
| 4.4 | Hồ sơ: ô dị ứng có gợi ý và dòng "Sẽ tránh" | Ảnh | **Cần chụp lại** (ảnh 12/11 trước bản sửa 13/11) |
| 4.5 | Thẻ món có nhãn "Chứa: …" / "Có thể chứa: …" | Ảnh | **Cần chụp** |
| 4.6 | Admin: Danh mục dữ liệu | Ảnh | **Cần chụp** (`/admin/catalog` chưa có trong AMH) |
| 4.7 | Kho thực phẩm | Ảnh `11-kho` | Có |
| 4.8 | Hộp xem trước khi bấm "Đã ăn" | Ảnh | **Cần chụp** |
| 4.9 | Lịch sử kho và hoàn tác | Ảnh `12-kho-lich-su` | Có |
| 4.10 | Quét hóa đơn: chọn ảnh và chế độ | Ảnh `13-quet-hoa-don` | Có |
| 4.11 | Màn duyệt kết quả quét | Ảnh | **Cần chụp** |
| 4.12 | Đăng nhập và hồ sơ dinh dưỡng | Ảnh `02`, `22` | Có |
| 4.13 | Thực đơn tuần | Ảnh `14-thuc-don` | Có |
| 4.14 | Tìm kiếm không dấu | Ảnh `16-tim-kiem` | Có |
| 4.15 | Trợ lý AI | Ảnh `20-tro-ly-ai` | Có |
| 4.16 | Báo cáo (dữ liệu mẫu) | Ảnh `21-bao-cao` | Có |
| 4.17 | Cộng đồng | Ảnh `19-cong-dong` | Có |
| 4.18 | Khu Admin: thống kê, kiểm duyệt, nhật ký | Ảnh `40`, `44`, `45` | Có |
| 4.19 | Giao diện điện thoại (Tổng quan, Kho, Thực đơn) | Ảnh `31`–`33` | Có |
| 5.1 | R@10 và P@10 của các phương pháp (mô phỏng) | Biểu đồ cột | Vẽ từ SL bảng 1 |
| 5.2 | R@10 theo số tương tác (khởi đầu lạnh) | Biểu đồ | Vẽ từ SL bảng 2 |
| 5.3 | Đánh đổi: R@10 so với tỷ lệ danh sách có đồ sắp hết hạn | Biểu đồ điểm | Vẽ từ SL bảng 1 |
| 5.4 | Bộ tạo thực đơn cũ và mới | Biểu đồ cột | Vẽ từ SL mục 3 |
| 5.5 | FCP trước và sau khi bật gzip (điện thoại giả lập) | Biểu đồ cột | Vẽ từ SL mục 4 |

### Bảng

| Số | Tên | Nguồn |
|---|---|---|
| 1.1 | So sánh Nouri với các ứng dụng liên quan | [CẦN BỔ SUNG] |
| 1.2 | Đối chiếu mục tiêu – nội dung – bằng chứng | mục B |
| 1.3 | Phần tự xây dựng và dịch vụ ngoài | KT mục 1, 4 |
| 1.4 | Các giai đoạn thực hiện | `CLAUDE.md`, UC |
| 2.1 | Các độ đo đánh giá gợi ý | TT mục 8 |
| 2.2 | Hai thành phần trí tuệ nhân tạo và cơ chế dự phòng | KT, CH mục E |
| 2.3 | Công nghệ và lý do chọn | KT mục 4 |
| 3.1 | Tác nhân | UC |
| 3.2 | Danh sách use case theo nhóm | UC |
| 3.3–3.7 | Đặc tả UC27, UC28, UC29, UC05, UC40 | UC |
| 3.8 | Yêu cầu phi chức năng | SL, KT |
| 3.9 | Tổ chức mã theo lớp | KT mục 2 |
| 3.10 | Chức năng dùng AI và đường dự phòng | KT mục 1 |
| 3.11 | Các cụm bảng dữ liệu | ERD |
| 3.12 | Các bảng danh mục nghiệp vụ | AH mục C, ERD |
| 3.13 | So sánh phương án lọc dị ứng | TT mục 2, AH |
| 3.14 | Quy tắc nhận nhóm dị ứng | TT mục 2 |
| 3.15 | Nguyên liệu chế biến và nhóm dị ứng (rút gọn) | TT mục 2 |
| 3.16 | Dị ứng và món không thích; nơi dùng hàm lọc | TT mục 2 |
| 3.17 | Ngữ cảnh gợi ý và trọng số ba thuật toán | TT mục 6 |
| 3.18 | Năm khối đặc trưng của món | TT mục 3 |
| 3.19 | Năm tiêu chí của thuật toán 3 | TT mục 5 |
| 3.20 | Tham số bộ trộn | TT mục 4, 6 |
| 3.21 | Mẫu lý do gợi ý | TT mục 6, GT 6.6 |
| 3.22 | Phương án cập nhật kho | UC12, TE |
| 3.23 | Hạn dùng ước tính theo nhóm và theo loại | SQL mục 4, `backend/prisma/catalog-data.ts` |
| 3.24 | Nguồn của dòng lịch sử kho | ERD (`PantryTransaction`) |
| 3.25 | So sánh hai cách đọc hóa đơn | KT mục 4, HC 2.4 |
| 3.26 | Mẫu dòng và từ khóa bỏ dòng | code + test bộ phân tích |
| 3.27 | Ví dụ chuẩn hóa tên in không dấu | `receipt-normalize.test.ts` |
| 4.1 | Môi trường, phiên bản | KT mục 4 |
| 4.2 | Quy mô hệ thống | SL mục 6 (sau khi cập nhật) |
| 4.3 | File và hàm chính của bộ gợi ý | GT bảng tra nhanh |
| 4.4 | File và hàm chính của lọc an toàn | GT mục 2 |
| 4.5 | File và hàm chính của luồng kho | UC28 |
| 4.6 | File và hàm chính của quét hóa đơn | code |
| 5.1 | Kết quả kiểm thử tự động | SL mục 1 |
| 5.2 | Các bộ test đáng chú ý | SL mục 1 |
| 5.3 | Thiết lập mô phỏng đánh giá gợi ý | SL mục 2 |
| 5.4 | Chọn trọng số bộ trộn trên tập kiểm định | SL mục 2 bảng 3 |
| 5.5 | Chọn w_pop0 trên tập kiểm định | SL mục 2 bảng 4 |
| 5.6 | Kết quả trên tập kiểm tra | SL mục 2 bảng 1 |
| 5.7 | R@10 theo số tương tác; trước/sau thành phần phổ biến | SL mục 2 bảng 2, 5 |
| 5.8 | Số liệu trước và sau commit `b8bc55a` | TT mục 10 |
| 5.9 | Đánh giá bộ tạo thực đơn | SL mục 3 |
| 5.10 | Ma trận an toàn: phạm vi và kết quả | SL mục 1, `dietary-matrix.test.ts` |
| 5.11 | Lỗi an toàn đã phát hiện và cách sửa | TT mục 2, 10 |
| 5.12 | Kịch bản kiểm thử trừ/hoàn kho | TE tru-kho |
| 5.13 | Đánh giá quét hóa đơn trên hóa đơn thật | [CẦN BỔ SUNG] |
| 5.14 | Tốc độ tải trang trước/sau gzip | SL mục 4 |
| 5.15 | Mức độ đáp ứng mục tiêu | mục B |

---

## D. Nguồn mâu thuẫn, lỗi thời và dữ liệu còn thiếu

### D1. Mâu thuẫn giữa các nguồn (đã đối chiếu với mã ngày 15/11/2026)

| # | Chỗ | Đang ghi | Thực tế theo mã / tài liệu sinh tự động | Ảnh hưởng |
|---|---|---|---|---|
| 1 | SL mục 6 (nguồn số liệu duy nhất) | 83 endpoint (10/54/19); 23 bảng / 16 enum / 33 khóa ngoại; 24 migration; "13 use case mới" | API (15/11): **87** (11/54/22); ERD (15/11): **32 / 19 / 39**; thư mục migrations: **26**; UC27–UC40 = **14** | **Phải sửa SL trước khi viết** Bảng 4.2, 3.11 |
| 2 | CH câu 3 | "80 endpoint, 23 bảng" | 87; 32 | Không dùng CH làm nguồn số |
| 3 | CH câu 2 | "13 use case mới (UC27–UC39)" | 14 (có UC40) | như trên |
| 4 | CH câu 35 | 1.737 test (1.234 + 503) | SL mục 1: 1.917 (1.395 + 522) | như trên |
| 5 | CH câu 9 | "w_pop0 (mã: 0,3)" và cùng câu "mã đã chọn lại 0,4" | Mã: 0,4 | Câu tự mâu thuẫn, cần sửa |
| 6 | CH câu 7 | "commit `e8dfad3`" | Số giống hệt, nhưng SL ghi commit `2ebc970` | Ghi theo SL |
| 7 | TT mục 2; HC 2.2; CH câu 40; SQL dòng 54 | Danh mục dị ứng nằm trong file `allergy-groups.ts`, "frontend chép y nguyên, test so hai file", "danh mục cố định" | Từ 14/11 danh mục nằm trong CSDL (9 bảng), frontend lấy qua `GET /api/catalog`, Admin sửa được (AH mục C, UC40); `allergy-groups.ts` chỉ còn logic | Quyển viết theo CSDL; nên sửa 4 chỗ này |
| 8 | TT | Thứ tự mục: 6 → 8 → 7 → 9 → 10 | — | Khi trích ghi đúng số mục |
| 9 | `README.md` | Thực đơn "OpenAI, hoặc bộ tạo chấm điểm khi không có AI"; khu Admin không nhắc "Danh mục dữ liệu" | UC09: mặc định là thuật toán, AI là lựa chọn phụ; có UC40 | Viết theo UC |
| 10 | `docs/ke-hoach-gd3c.md` (kế hoạch 9/11) | Giá không lưu; tên file `ReceiptReviewList.tsx`; kết quả `ket-qua-<provider>.md`; hai chế độ | UC29, UC06: có đơn giá; ba chế độ (Tự động / AI / Dự phòng); SL: `ket-qua.md` | Chỉ dùng cho lý do thiết kế; chi tiết phải đọc code khi viết 3.7 |
| 11 | KT, UC (đầu file ghi 12/11) | Ngày "12/11/2026" | UC đã có UC40 (14/11); KT đã ghi w_pop0 = 0,4 (15/11) | Chỉ là nhãn ngày |
| 12 | AMH (chụp 12/11) | 29 màn hình | Chụp trước bản sửa dị ứng 13/11, danh mục 14–15/11, đổi tham số 15/11: ảnh Hồ sơ, Công thức, thanh bên Admin có thể đã khác; thiếu 5 ảnh (mục C) | Cần chụp lại cả bộ sau `demo:reset` |
| 13 | SL mục 4 | Bảng FCP/LCP đo 3/11, trước tách gói 12/11 | SL đã tự ghi chú | Ghi rõ thời điểm đo |
| 14 | RN | Khảo sát ban đầu (JWT dài hạn, AI một phần…) | Đã thay đổi nhiều | Chỉ dùng cho 1.4.1 "hiện trạng ban đầu" |
| 15 | Tên đề tài | "ứng dụng" | Sản phẩm là website (SPA), không có app di động gốc | Nêu ở phần phạm vi |

### D2. Dữ liệu còn thiếu

| # | Thiếu | Cần cho mục | Cách bổ sung |
|---|---|---|---|
| 1 | Tên giảng viên hướng dẫn, ngày giao đề tài (phiếu giao đã có nguyên văn) | Mở đầu | Người viết cung cấp |
| 2 | Mẫu quyển của trường, độ dài yêu cầu | Toàn bộ | Người viết cung cấp |
| 3 | Đánh giá OCR trên hóa đơn thật (tỉ lệ đúng, thời gian, chi phí) | 5.6, GT2 | ~10 ảnh vào `docs/test-evidence/receipts/` rồi `npm run eval:receipt -w backend` |
| 4 | Khảo sát ứng dụng liên quan | 1.2 | Chọn 3–4 ứng dụng, trích từ trang chính thức |
| 5 | Số liệu lãng phí thực phẩm (thế giới, Việt Nam) | Mở đầu, 1.1.1 | Tài liệu tham khảo kiểm được |
| 6 | Đánh giá với người dùng thật (khảo sát, thời gian tiết kiệm, mức giảm lãng phí) | MT1, MT2, MT5, KQ3 | Nếu không làm kịp: ghi là hạn chế, không khẳng định |
| 7 | Lỗi thật của luồng kho và quét hóa đơn | 5.5, 5.6 | Tra `docs/lich-su-giai-doan.md` và lịch sử git ở lượt viết Chương 5 |
| 8 | Chi tiết bộ phân tích/chuẩn hóa hóa đơn (mẫu nhận dạng, số ca test) | 3.7.3–3.7.4 | Đọc `backend/src/services/receipt/*.ts` và test ở lượt viết Chương 3 |
| 9 | Công thức BMR, hệ số vận động đúng theo code | 2.1.1 | Đọc `services/nutrition.service.ts` |
| 10 | Thông tin giảng viên hướng dẫn, ngày giao các yêu cầu thêm | Mở đầu | Người viết cung cấp |

---

## E. Điểm mạnh và điểm dễ bị hỏi

### E1. Năm điểm hội đồng dễ chấm cao

| # | Điểm | Cách trình bày |
|---|---|---|
| 1 | Ba thuật toán gợi ý tự xây, có công thức, có đánh giá với phương án cơ sở, có tập kiểm định tách khỏi tập kiểm tra và quy tắc chọn đặt trước | 3.5 đủ công thức + giả mã; 5.2 đặt bảng chọn tham số (5.4–5.5) trước bảng kết quả tập kiểm tra (5.6) để thấy tham số không chọn trên tập kiểm tra |
| 2 | An toàn dị ứng được kiểm chứng: lọc trước mọi thuật toán, ma trận 105 hồ sơ, đối chứng 13,5% khi không lọc, hai lỗi thật đã tìm ra và sửa | 5.4 đặt hai lỗi thật thành bảng "trước – sau"; nhấn mạnh cùng một hàm dùng ở 8 nơi |
| 3 | Vòng khép kín kho có tính toàn vẹn: một transaction, ghi có điều kiện chống ghi đè, hoàn tác không lặp, bằng chứng kịch bản 14/14 và 6/6 | Hình 3.12–3.13 + Bảng 5.12; ví dụ Hành tím 6 g + 4 g |
| 4 | Trung thực về số liệu: tự phát hiện số đánh giá đổi sau khi sửa lỗi, truy ra commit gây đổi, chạy lại và chọn lại tham số theo đúng quy tắc | 5.2.6 viết thành một mục riêng, không giấu |
| 5 | Kỹ thuật phần mềm: 1.917 test tự động, dữ liệu nghiệp vụ trong CSDL có Admin quản lý và nhật ký, mọi chức năng AI có đường dự phòng | Bảng 3.10 và Bảng 5.1; mục 3.3.3 nêu rõ đây là đáp ứng nhận xét của giảng viên |

### E2. Năm điểm dễ bị hỏi xoáy

| # | Câu hỏi có thể gặp | Cách quyển nên trình bày |
|---|---|---|
| 1 | "Trí tuệ nhân tạo ở đâu? Chỉ gọi API OpenAI thôi à?" | Mục 2.3.1 và Bảng 2.2 tách hai thành phần: (a) hệ gợi ý là thuật toán do đề tài xây dựng (lọc nội dung, lọc cộng tác, dựa trên tri thức) — gọi đúng tên là hệ gợi ý, **không** gọi là "mô hình học sâu", không nói "huấn luyện"; (b) mô hình ngôn ngữ lớn dùng qua API cho đọc hóa đơn, trợ lý, kiểm duyệt, ước tính dinh dưỡng, tạo thực đơn tùy chọn. Nêu rõ đề tài không huấn luyện mô hình nào; phần đóng góp là thiết kế thuật toán gợi ý, lớp kiểm lại kết quả AI và cơ chế dự phòng |
| 2 | "Dữ liệu mô phỏng thì số liệu có ý nghĩa gì?" | Mọi bảng Chương 5 ghi "dữ liệu mô phỏng" ngay trong tên bảng; 5.2.8 nêu đủ hạn chế (thiên vị thuật toán 1, 33 món nên ngẫu nhiên cũng đạt 0,377…); chỉ rút kết luận **so sánh tương đối** giữa các phương pháp; không viết "độ chính xác của hệ thống là …" |
| 3 | "Mục tiêu 'hương vị phù hợp' đạt thế nào?" | Viết đúng mức: hệ thống suy ra khẩu vị gián tiếp từ ẩm thực ưa thích, món không thích và lịch sử ăn/thích (thuật toán 1), chưa mô hình hóa vị (cay, ngọt, mặn) và chưa hỏi người dùng đánh giá. Đưa vào hạn chế và hướng phát triển; không dùng chữ "đảm bảo hợp khẩu vị" |
| 4 | "Giảm lãng phí được bao nhiêu? Tiết kiệm bao nhiêu thời gian?" | Bảng 1.2 có cột "Mức chứng minh được": chỉ có cơ chế và số mô phỏng (82,3%, 54,0%); trang Báo cáo của demo là dữ liệu mẫu. Không nêu con số giảm lãng phí thật; ghi đánh giá với người dùng thật là hướng phát triển |
| 5 | "Quét hóa đơn đúng bao nhiêu phần trăm? Dị ứng có sót không?" | 5.6 nói thẳng chưa đo trên hóa đơn thật, công cụ đo đã sẵn sàng, màn duyệt bắt buộc vì OCR có thể sai (nếu kịp bổ sung ~10 ảnh trước 2/12 thì điền Bảng 5.13). Dị ứng: lọc theo tên và danh mục, thành phần thật tùy nhãn hàng nên có thể lọc dư hoặc sót với tên lạ; người dị ứng nặng vẫn phải đọc nhãn (HC 2.2) |

Câu hỏi phụ nên chuẩn bị sẵn trong quyển: thuật toán 2 có R@10 thấp nhất (0,230) — giải thích ở 5.2.3 bằng thiết kế không gợi ý lại món đã ăn và R@10 món mới cao nhất (0,567); bộ món chỉ 33 món; tên đề tài ghi "ứng dụng" nhưng sản phẩm là website.
