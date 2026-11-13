# Câu hỏi hội đồng có thể hỏi và câu trả lời

Trả lời ngắn, dựa trên mã và số liệu thật trên `main` (12/11/2026). Mỗi câu ghi file nguồn để mở ra khi cần. Số liệu chi tiết:
`docs/bao-cao/so-lieu.md`; hạn chế: `docs/han-che.md`.

## A. Tổng quan

**1. Nouri giải quyết bài toán gì?**
Giảm lãng phí thực phẩm trong gia đình và ăn đúng mục tiêu dinh dưỡng: quản lý kho có hạn dùng, gợi ý món ưu tiên đồ sắp hết hạn và hợp
hồ sơ (dị ứng, chế độ ăn, calo), lập thực đơn 7 ngày, tự trừ/nhập kho khi ăn/mua, quét hóa đơn, báo cáo lãng phí.
Nguồn: `REPORT_NOURI.md`, `docs/bao-cao/use-case.md`.

**2. Phạm vi so với khảo sát ban đầu?**
26 use case khảo sát: 15 làm đúng, 11 làm khác/mở rộng; phần "theo dõi thành viên" của UC25 không làm (ngoài trọng tâm, ghi ở
`docs/han-che.md`). Thêm 13 use case mới (UC27–UC39). Nguồn: `docs/bao-cao/use-case.md`.

**3. Hệ thống gồm những thành phần nào?**
SPA React 19 (nginx) → API Express 5 → PostgreSQL 16 qua Prisma 6; dịch vụ ngoài tùy chọn: OpenAI, Cloudinary, SMTP. 80 endpoint, 23 bảng.
Nguồn: `docs/bao-cao/kien-truc.md`, `api.md`, `erd.md`.

## B. Thuật toán gợi ý

**4. Ba thuật toán gợi ý là gì?**
(1) Lọc theo nội dung: vector hồ sơ sở thích từ lịch sử (có suy giảm theo thời gian) + tiên nghiệm từ hồ sơ, điểm = tổng cosine có trọng
số theo khối đặc trưng. (2) Cộng tác item–item trên phản hồi ngầm: cosine giữa cột món, co rút λ = 5, k = 20 láng giềng. (3) Dựa trên tri
thức: s3 = 0,35·f_hạn + 0,25·f_kho + 0,20·f_dd + 0,10·f_dạng + 0,10·f_ưu.
Nguồn: `backend/src/modules/recommendation/content-based.ts`, `collaborative.ts`, `knowledge-based.ts`.

**5. Trộn ba thuật toán thế nào?**
Trọng số theo ngữ cảnh (`CONTEXT_WEIGHTS`): "for-you" 0,60/0,20/0,20; "today" 0,35/0,25/0,40; "pantry" 0,15/0,10/0,75. Trọng số cộng tác
nhân γ = n/(n + 10) theo số tương tác, phần dư chia cho hai thuật toán kia. Thêm thành phần phổ biến w_pop = (1 − γ)·0,3. Cuối cùng đa
dạng hóa MMR (λ = 0,8). Nguồn: `backend/src/modules/recommendation/hybrid.ts`.

**6. Vì sao chọn 0,60/0,20/0,20 cho "for-you"?**
So sáu bộ trọng số trên tập **kiểm định** (không dùng tập kiểm tra) với quy tắc đặt trước: chỉ đổi khi R@10 cao hơn ≥ 0,01. Bộ này
0,660 so với bộ kế hoạch 0,627. Nguồn: `docs/thuat-toan-goi-y.md` mục 8, bảng 3.

**7. Đánh giá bộ gợi ý thế nào, kết quả ra sao?**
Mô phỏng 5 lần × 80 người × 28 ngày, chia 80/20 theo thời gian. Bộ trộn + phổ biến: P@10 0,170, R@10 0,622 (ngẫu nhiên 0,352, phổ biến
nhất 0,564, nội dung 0,618); lệch calo 38,2 %, 78,5 % danh sách có đồ sắp hết hạn; 0 % vi phạm an toàn. Đây là dữ liệu **mô phỏng**.
Nguồn: `docs/bao-cao/so-lieu.md` mục 2.

**8. Sao không chỉ dùng thuật toán 1 khi nó đúng nhất?**
Thuật toán 1 ít đa dạng nhất (0,607) và hay gợi ý lại món đã ăn (R@10 món mới 0,268). Bộ trộn đổi một chút độ đúng (0,622 so với 0,618
là tương đương) để có món mới tốt hơn (0,347), lệch calo thấp hơn và dùng đồ sắp hết hạn nhiều hơn (78,5 % so với 62,2 %).
Nguồn: `docs/thuat-toan-goi-y.md` bảng 1.

**9. Xử lý khởi đầu lạnh?**
Người chưa có tương tác: γ = 0 nên trọng số cộng tác bằng 0, thành phần phổ biến nhận đủ 0,3; thuật toán 1 dùng tiên nghiệm từ hồ sơ.
w_pop0 = 0,3 chọn trên tập kiểm định: R@10 nhóm 0 tương tác 0,556 → 0,778, tổng không giảm. Nguồn: `docs/thuat-toan-goi-y.md` bảng 4.

**10. Làm sao bảo đảm không gợi ý món gây dị ứng?**
Lọc an toàn chạy **trước** mọi thuật toán (`safety.ts`): dị ứng mở rộng theo nhóm, món không thích, chay/thuần chay, món ẩn, đúng bữa.
Ma trận test 105 hồ sơ × mọi nguồn gợi ý/thực đơn: 0 món vi phạm. Không lọc thì "phổ biến nhất" có 11,8 % món vi phạm.
Nguồn: `backend/src/modules/recommendation/safety.ts`, `backend/src/test/dietary-matrix.test.ts`.

**11. Tài khoản mẫu có làm sai lệch đánh giá không?**
Không: đánh giá dùng dữ liệu mô phỏng riêng trong bộ nhớ. 8 tài khoản mẫu chỉ để thuật toán cộng tác có dữ liệu khi demo, gắn cờ
`isSample`, không đăng nhập được, không tính vào thống kê Admin. Nguồn: `docs/thuat-toan-goi-y.md` mục 7.

## C. Thực đơn

**12. Tạo thực đơn khi không có OpenAI?**
`scoredPlan`: xếp từng bữa, điểm S = s3 + 0,3·s1 − 0,1·(số lần đã xếp); điều kiện cứng không lặp trong ngày, không lặp 3 ngày, calo trong
±35 % mục tiêu bữa; "kho ảo" trừ dần nguyên liệu để không dùng quá lượng đồ sắp hết hạn. Nguồn: `meal-plan-scorer.ts`.

**13. So với bộ tạo cũ?**
Mô phỏng 500 thực đơn: lệch calo ngày 32,6 % → 25,2 %; đồ sắp hết hạn dùng trước hạn 44,1 % → 54,7 %; bữa lặp trong 3 ngày 2,34 → 1,65.
Nguồn: `docs/thuat-toan-goi-y.md` mục 9.

**14. Có OpenAI thì sao, có tin AI hoàn toàn không?**
Không: kết quả OpenAI luôn qua `reconcileAIPlan` (chỉ món trong danh sách đã lọc an toàn, đúng bữa, không lặp trong ngày; bữa vi phạm bị
thay; hỏng quá nửa số bữa → dùng cả thực đơn của `scoredPlan`). Nguồn: `meal-plan-generator.ts`.

**14a. Vì sao mặc định tạo thực đơn bằng thuật toán, không phải AI?**
Đo thật: OpenAI cần 80–120 giây cho thực đơn 7 ngày (lần đầu còn bị nginx cắt ở 60 giây), còn `scoredPlan` xong trong vài giây và đã được
đánh giá trên 500 thực đơn mô phỏng (mục 13); kết quả AI cũng phải qua lọc an toàn như thuật toán. Vì vậy mặc định là thuật toán (nhanh,
kiểm chứng được, không tốn phí, chạy cả khi không có mạng tới OpenAI). AI là lựa chọn phụ "Tạo bằng AI (1–2 phút)": chạy nền, người dùng
được rời trang, xong có thông báo; AI lỗi/quá 120 giây thì vẫn có thực đơn bằng thuật toán kèm lý do. Nguồn: `meal-plan-jobs.ts`.

## D. Kho, "đã ăn", quét hóa đơn

**15. "Đã ăn" trừ kho thế nào?**
Lượng = số lượng nguyên liệu × khẩu phần bữa / khẩu phần món; khớp tên bỏ hoa thường/khoảng trắng, quy đổi g↔kg, ml↔l; trừ hạn sớm trước,
mặc định không trừ đồ đã hết hạn; người dùng xem trước và chỉnh. Nguồn: `meal-consumption.service.ts`, `services/pantry-consumption.ts`.

**16. Hai thiết bị cùng trừ một thực phẩm thì sao?**
Mỗi lệnh trừ dùng `updateMany` với điều kiện số lượng cũ; ai đến sau thấy số lượng đã đổi → dòng đó bị bỏ qua và báo lại. Mọi thay đổi kho
ghi `PantryTransaction` trong cùng transaction; hoàn lại trỏ `reversalOfId`, không hoàn hai lần. Nguồn: `meal-consumption.service.ts`,
`pantry-intake.ts`.

**17. Quét hóa đơn hoạt động thế nào?**
Ảnh → sharp (xoay, xóa EXIF, thu nhỏ) → đọc nền bằng OpenAI Vision (structured output) hoặc Tesseract (vie+eng, chạy trên máy chủ) → bộ
phân tích bỏ dòng tổng tiền/VAT/túi/phí → chuẩn hóa tên theo kho và bộ món, đơn vị, nhóm, hạn ước tính → màn duyệt bắt buộc → lưu một lô.
Nguồn: `backend/src/services/receipt/`, `modules/receipt-scan/`.

**18. OpenAI lỗi khi quét thì sao?**
Chế độ "Tự động": OpenAI lỗi/hết giờ (60 s) → đọc lại bằng Tesseract, màn duyệt báo lý do, DB ghi `fallbackCode`. Chọn hẳn "Đọc bằng AI" thì
báo lỗi, không tự chuyển. Nguồn: `receipt-scan.service.ts`, `providers/openai-vision-provider.ts`.

**19. Độ chính xác OCR?**
Chưa có số đo trên hóa đơn thật (chưa có bộ ảnh). Đã có script `eval:receipt` đo tỉ lệ đúng dòng/tên/số lượng/đơn vị, thời gian, chi phí
cho cả hai chế độ; màn duyệt bắt buộc vì OCR có thể sai. Nguồn: `backend/scripts/eval-receipt-ocr.ts`, `docs/bao-cao/so-lieu.md` mục 5.

**20. Ảnh hóa đơn có bị lưu lại không?**
Không: chỉ nằm trong bộ nhớ khi đọc, không ghi đĩa, không lên Cloudinary; dòng nháp giữ trong bộ nhớ 30 phút. Chế độ AI có dòng nhắc ảnh
gửi tới dịch vụ AI bên ngoài. Nguồn: `services/receipt/receipt-image.ts`, `receipt-scan.jobs.ts`.

**21. Báo cáo lãng phí tính thế nào?**
Từ lịch sử kho: "bỏ đi" = xóa với lý do Bỏ đi; "dùng" = trừ khi ăn, sửa về 0, xóa "Đã dùng hết" khi còn hàng; "Nhập nhầm" không tính.
Tỉ lệ dùng trước hạn = dùng trước hạn / (dùng + bỏ đi); tiền lãng phí chỉ trên món có đơn giá. Tuần bắt đầu Thứ Hai 00:00 giờ Việt Nam.
Nguồn: `backend/src/modules/reports/reports.logic.ts`.

## E. AI

**22. Trợ lý AI có thể gợi ý món gây dị ứng không?**
Hai lớp: prompt cố định (không đổi theo câu hỏi, kể cả "bỏ qua hướng dẫn") cấm gợi ý/gọi tên thành phần dị ứng; sau khi nhận câu trả lời,
backend so khớp từ khóa dị ứng và hiện cảnh báo trên tin. Lớp hai có thể báo thừa — chủ đích ưu tiên không bỏ sót.
Nguồn: `modules/ai/ai.prompts.ts`, `chat-context.ts` (`answerAllergyWarnings`).

**23. Gửi gì cho OpenAI khi chat?**
Hồ sơ rút gọn (không id, email), ràng buộc an toàn, kho (≤ 40 thực phẩm, tách đồ còn ≤ 3 ngày), thực đơn 3 ngày, 6 tin gần nhất (mỗi tin
≤ 600 ký tự). 30 câu/người/ngày. Nguồn: `modules/ai/chat.service.ts`, `chat-context.ts`.

**24. Không có key thì AI ra sao?**
Mọi chức năng có đường dự phòng: thực đơn → `scoredPlan`; chat → báo chưa bật (503) và gợi ý "Gợi ý cho bạn"/"Nấu gì từ kho?"; quét →
Tesseract; kiểm duyệt → đăng như thường; ước tính dinh dưỡng → Admin tự nhập. Nguồn: `docs/bao-cao/kien-truc.md` mục 1.

**25. AI kiểm duyệt bài viết thế nào, có tự xóa bài không?**
Moderation API (chữ + ảnh) và model mini kiểm "liên quan ăn uống" chạy song song, hạn chung 8 giây; nghi vấn → chờ duyệt, chỉ tác giả thấy,
lưu lý do; Admin Duyệt/Ẩn. AI không bao giờ xóa bài; lỗi/quá giờ → đăng như thường. Nguồn: `modules/community/community-ai-review.ts`.

## F. Bảo mật

**26. Phiên đăng nhập bảo vệ thế nào?**
Access token JWT 15 phút; refresh token trong cookie httpOnly, `SameSite=Strict`, `Path=/api/auth`, DB chỉ lưu SHA-256; xoay vòng mỗi lần
làm mới, dùng lại token cũ → thu hồi cả chuỗi (cho 10 giây cho hai tab). Nguồn: `modules/auth/refresh-token.service.ts`,
`docs/test-evidence/bao-mat.md`.

**27. Đăng xuất, đổi mật khẩu, khóa tài khoản có hiệu lực ngay không?**
Đăng xuất thu hồi refresh token (access token còn tối đa 15 phút). Đổi mật khẩu ghi `passwordChangedAt` nên access token cũ bị chặn ngay;
khóa tài khoản: `requireAuth` đọc `lockedAt` từ DB mỗi request → 403. Nguồn: `middleware/auth.ts`.

**28. Chống lộ dữ liệu người khác?**
`userId` luôn lấy từ JWT, không nhận từ client; truy vấn lọc theo `userId`; dữ liệu của người khác trả 404 (không lộ sự tồn tại). Test HTTP
từng module kiểm quyền sở hữu. Nguồn: các `*.service.ts`, `*.test.ts`.

**29. Quên mật khẩu có an toàn không?**
Luôn cùng một câu trả lời, email gửi nền (thời gian như nhau); token 32 byte, lưu SHA-256, hết hạn 30 phút, dùng một lần (điều kiện
`usedAt: null` trong transaction), yêu cầu mới xóa token cũ; 5 lần/giờ/email và /IP; đổi xong thu hồi mọi phiên.
Nguồn: `modules/auth/password-reset.service.ts`.

**30. Chống dò mật khẩu, spam?**
Rate limit: đăng nhập/đăng ký 20 lần/phút/IP; quên mật khẩu 5/giờ/email và /IP; body JSON ≤ 100 KB; bcrypt cost 12. Bộ đếm trong bộ nhớ một
tiến trình (hạn chế đã ghi). Nguồn: `middleware/rate-limit.ts`, `auth.routes.ts`, `docs/han-che.md` mục 1.

**31. Ảnh tải lên có rủi ro gì, xử lý ra sao?**
Chỉ nhận jpg/png/webp kiểm bằng byte đầu (không tin đuôi file), ≤ 5 MB, ≤ 4 ảnh/bài; xóa EXIF/GPS bằng sharp trước khi lên Cloudinary.
Nguồn: `services/image-file.ts`, `image-sanitize.ts`, `docs/test-evidence/2026-10-31_gd3-l6_exif-gps.txt`.

**32. Còn lỗ hổng phụ thuộc nào?**
`npm audit` còn 9 (chỉ sửa được bằng nâng bản lớn prisma 7, zod 4, openai 7, sharp 0.35, vitest 5); quyết định không nâng trước hạn đóng
băng, rủi ro thực tế thấp (giải thích từng gói). `nodemailer` chọn bản 10.3.1 vì các bản ≤ 10.1.3 có cảnh báo. Nguồn: `docs/han-che.md` 1.1.

## G. Dữ liệu mẫu, kiểm thử, triển khai

**33. Số liệu trên trang Báo cáo khi demo có thật không?**
Không: `demo:reset` tạo 8 tuần lịch sử kho **mẫu** (bỏ đi 4 → 1 món/tuần, dùng trước hạn tăng dần) để minh họa; không dùng làm kết quả
đánh giá. Nguồn: `backend/prisma/demo-report.ts`, `docs/bao-cao/so-lieu.md` mục 7.

**34. Dinh dưỡng của món lấy từ đâu?**
Ước tính, tham khảo *Bảng thành phần thực phẩm Việt Nam* (Viện Dinh dưỡng, 2007); chỉ tiêu cá nhân: BMR Mifflin–St Jeor (10·cân nặng +
6,25·chiều cao − 5·tuổi ± hằng số giới tính) × hệ số vận động. Nguồn: `backend/prisma/seed-data.ts`, `services/nutrition.service.ts`.

**35. Kiểm thử thế nào?**
1.737 test tự động (backend 1.234, frontend 503) chạy không cần CSDL/mạng: Prisma giả lập kèm transaction giả, OpenAI/Cloudinary/SMTP
giả lập, đồng hồ giả. Kiểm cả quy tắc giao diện và kiểm kê nút Admin. Đo hiệu năng riêng: gợi ý < 150 ms với 500 món × 1.000 người.
Nguồn: `docs/bao-cao/so-lieu.md` mục 1.

**36. Có kiểm giao diện thật không?**
Có, bằng Playwright khi cần đo: tràn ngang ở 1201–1920 px, so ảnh trước/sau khi đổi CSS dùng chung (0 điểm ảnh khác), tốc độ tải khi bật
gzip (điện thoại giả lập: FCP trang chủ 5,14 s → 2,20 s). Nguồn: `docs/test-evidence/`, `docs/bao-cao/so-lieu.md` mục 4.

**37. Triển khai thế nào?**
Docker Compose: postgres:16-alpine, backend node:22-alpine (chạy migration khi khởi động, cổng chỉ nghe 127.0.0.1), frontend build Vite +
nginx:1.27-alpine (gzip, chuyển `/api`). Biến môi trường khai báo trong `env.ts` (Zod) và `.env.example`. Nguồn: `docker-compose.yml`.

**38. Hướng phát triển chính?**
Theo dõi thành viên, lưu lượng nước vào tài khoản, đăng nhập Google, chế độ tối, đánh giá OCR trên hóa đơn thật, nhận diện dị ứng
theo thành phần ẩn, Redis cho trạng thái dùng chung, thông báo đẩy. Nguồn: `docs/han-che.md` mục 3.

**40. Người dùng gõ sai tên dị ứng thì sao?**
Không bị bỏ qua. Nouri chuẩn hóa (bỏ dấu khi gõ không dấu, bỏ "dị ứng", "bị", "với"), so với danh mục 11 nhóm (tên nhóm, tên gọi khác hai
miền và tiếng Anh, nguyên liệu thuộc nhóm): "trứng gà", "trung ga", "egg", "lòng đỏ" đều thành nhóm Trứng. Không nhận ra thì vẫn lọc
theo đúng chữ đó (nguyên từ, hai chiều) và ô nhập báo "Nouri chưa nhận ra … — sẽ lọc theo đúng chữ này", kèm "Có phải bạn muốn: Trứng?"
nếu sai 1–2 ký tự; hệ thống không tự đoán. Dưới ô luôn hiện "Sẽ tránh: …" để người dùng kiểm lại. Kiểm bằng ma trận an toàn với 14 cách
gõ. Nguồn: `allergy-groups.ts`, `docs/thuat-toan-goi-y.md` mục 2.

**39. Sao không có chế độ tối?**
Đã có bản chế độ tối nhưng bỏ (12/11/2026) để tập trung chất lượng: mỗi màn hình, trạng thái, biểu đồ và trang chủ (bộ màu riêng) phải
kiểm tương phản và chụp so sánh hai lần, dễ sót lỗi trước hạn nộp. Giữ một giao diện sáng đã kiểm WCAG AA bằng test
(`contrast.test.ts`), đặt `color-scheme: light` để máy để chế độ tối vẫn hiện đúng. Thêm lại là hướng phát triển (`docs/han-che.md` mục 3).
