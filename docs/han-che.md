# Hạn chế, rủi ro đã biết và hướng phát triển

Tài liệu cho báo cáo đồ án, đối chiếu với mã trên `main` (12/11/2026). Mục 1: rủi ro bảo mật và vận hành; mục 2: hạn chế về dữ liệu,
thuật toán, chức năng; mục 3: hướng phát triển. Số liệu đánh giá: `docs/bao-cao/so-lieu.md`.

## 1. Rủi ro đã biết

### 1.1. Gói phụ thuộc còn lỗ hổng (chưa nâng bản lớn — quyết định 10/11/2026)

`npm audit fix` (chỉ bản vá trong phạm vi semver) đã giảm từ 18 xuống 9 lỗ hổng. 9 lỗ hổng còn lại chỉ sửa được bằng cách nâng bản lớn
(đổi API, phải sửa và kiểm thử lại nhiều chỗ). Do sát hạn đóng băng code (25/11/2026), **không nâng** trong đồ án:

| Gói | Mức | Bản cần nâng | Vì sao rủi ro thực tế thấp |
|---|---|---|---|
| `prisma`, `@prisma/client` (qua `@prisma/config` → `deepmerge-ts`) | cao | Prisma 7 | Thư viện của công cụ dòng lệnh, chạy lúc build/migrate, không nhận dữ liệu người dùng |
| `zod` | cao | Zod 4 | Lỗi cạn bộ nhớ khi kiểm tra mảng rất lớn; body JSON đã giới hạn 100 KB và mảng có `max()` |
| `openai` | cao | openai 7 | Chỉ do phụ thuộc zod bản cũ; chỉ gửi dữ liệu do server dựng tới OpenAI |
| `sharp` | cao | 0.35 | Lỗ hổng ở thư viện ảnh libvips/libheif/librsvg; ảnh tải lên chỉ nhận jpg/png/webp (kiểm byte đầu), ≤ 5 MB, không nhận HEIF/SVG |
| `vitest` (kèm `tinypool`, `@vitest/mocker`) | nghiêm trọng | Vitest 5 | Chỉ dùng khi chạy test trên máy dev, không có trong bản chạy |

Chi tiết cách kiểm: `docs/test-evidence/bao-mat.md`. Hướng xử lý: nâng từng gói trên nhánh riêng sau khi bảo vệ, chạy lại toàn bộ test.

### 1.2. Khác (bảo mật)

- Rate limit đăng nhập/đăng ký lưu trong bộ nhớ một tiến trình: khởi động lại backend thì mất bộ đếm; chạy nhiều tiến trình cần kho chung (Redis).
- Access token (15 phút) lưu ở `localStorage`/`sessionStorage`, đọc được bằng JavaScript nếu trang bị XSS; refresh token nằm trong cookie
  `HttpOnly` nên không bị lộ theo cách này.
- Đăng xuất thu hồi refresh token; access token đã phát còn dùng được tối đa 15 phút (khóa tài khoản và đổi mật khẩu thì bị chặn ngay).

### 1.3. Trợ lý AI và kiểm duyệt bằng AI

- Cảnh báo dị ứng dưới câu trả lời của Hỏi Nouri so khớp từ khóa (nhóm dị ứng mở rộng) trên toàn bộ nội dung trả lời. AI được dặn không
  gọi tên thành phần dị ứng, nhưng nếu vẫn nhắc tới để khuyên tránh (vd. "không dùng tôm") thì cảnh báo vẫn hiện: **báo thừa**. Chọn
  như vậy có chủ đích, ưu tiên không bỏ sót hơn là không báo nhầm.
- Kiểm duyệt bài cộng đồng gọi Moderation API và kiểm tra "liên quan ăn uống" song song, hạn chung 8 giây; quá giờ hoặc lỗi thì bài
  được đăng như thường (không chặn người dùng), nên bài vi phạm lúc dịch vụ AI gặp sự cố chỉ được phát hiện khi Admin xem.

### 1.4. Vận hành

- Các trạng thái chỉ giữ trong bộ nhớ một tiến trình backend: bộ đếm rate limit (đăng nhập, đăng ký, quên mật khẩu, tắt nhắc), dòng nháp
  quét hóa đơn (30 phút), mô hình gợi ý cộng tác (nhớ 10 phút). Khởi động lại backend thì mất (người dùng quét lại); chạy nhiều tiến trình
  cần kho chung (Redis).
- Lịch nhắc hạn email chạy trong tiến trình backend (`node-cron`): backend tắt đúng lúc 07:00 thì hôm đó không gửi bù. Khóa chống gửi trùng
  nằm ở DB nên chạy nhiều tiến trình vẫn chỉ một email/người/ngày.
- Chưa cấu hình SMTP thì email (kể cả liên kết đặt lại mật khẩu) được ghi ra log để thử ở máy dev; bản chạy thật bắt buộc cấu hình SMTP.
- Ảnh đã xóa (xóa bài, thay ảnh món) vẫn mở được qua link cũ khoảng 1 phút do bộ nhớ đệm CDN của Cloudinary, dù đã xóa kèm `invalidate`.

## 2. Hạn chế

### 2.1. Dữ liệu

- Dinh dưỡng của 33 món seed là **số liệu ước tính**, tham khảo *Bảng thành phần thực phẩm Việt Nam* (Viện Dinh dưỡng, NXB Y học, 2007);
  dinh dưỡng do AI ước tính khi "Chuyển thành công thức" cũng chỉ là gợi ý, Admin phải kiểm trước khi lưu.
- Bộ món nhỏ (33 món) nên gợi ý và thực đơn lặp món nhiều hơn khi dùng lâu.
- Tài khoản mẫu (`mauN@nouri.vn`), lịch sử mẫu của demo và dữ liệu mẫu 8 tuần cho trang Báo cáo là **dữ liệu dựng sẵn**, không phải
  hoạt động thật; tài khoản mẫu không tính vào thống kê Admin.
- Admin sửa một món đã có trong thực đơn cũ thì thực đơn cũ giữ calo đã lưu ở bữa, nhưng tên, ảnh, nguyên liệu hiển thị theo bản đã sửa.

### 2.2. An toàn thực phẩm (dị ứng, chế độ ăn)

- So khớp dị ứng dựa trên **tên** nguyên liệu và bảng nhóm dị ứng cố định (`dietary.service.ts`, vd. "Hải sản" → tôm, cua, cá, nước mắm…);
  nguyên liệu có thành phần ẩn (vd. nước tương có lúa mì) có thể không bị phát hiện.
- Kiểm nhãn chay/thuần chay dựa trên tên nguyên liệu và bộ từ khóa cố định.
- Công thức tự viết của thành viên chỉ được cảnh báo dị ứng theo tên nguyên liệu, chưa được kiểm duyệt dinh dưỡng.

### 2.3. Thuật toán gợi ý và thực đơn

- Trọng số bộ gợi ý được chọn bằng **đánh giá mô phỏng** trên người dùng giả lập (`npm run eval:recommend`), chưa có người dùng thật để
  đánh giá trực tuyến (A/B, tỉ lệ bấm).
- Thuật toán cộng tác cần đủ tương tác; người dùng mới ở trạng thái "khởi đầu lạnh", trọng số chuyển sang tri thức + phổ biến.
- Thực đơn không có OpenAI dùng thuật toán chấm điểm (`scoredPlan`): giữ calo mỗi bữa trong ±35 % mục tiêu bữa, không tối ưu đồng thời
  mọi macro; thực đơn từ OpenAI luôn được kiểm lại qua lọc an toàn nhưng chất lượng phụ thuộc model.

### 2.4. Quét hóa đơn (OCR)

- Chưa đánh giá trên bộ ~10 hóa đơn thật (`eval:receipt` đã sẵn sàng, chờ ảnh); số liệu hiện có chỉ là test với dữ liệu giả lập.
- Tesseract (chế độ dự phòng) đọc kém với ảnh nghiêng, mờ, hóa đơn in nhiệt mờ; vì vậy màn duyệt là bắt buộc.
- Bộ phân tích quy tắc tối ưu cho hóa đơn siêu thị Việt Nam in không dấu; hóa đơn viết tay thường đọc sai.
- Chế độ AI gửi ảnh tới OpenAI (có ghi rõ trên màn quét); chi phí mỗi lần quét được ghi token vào/ra trong DB.

### 2.5. Trợ lý AI

- Xem mục 1.3. Thêm: chỉ gửi 6 tin gần nhất làm ngữ cảnh nên AI không nhớ cuộc trò chuyện dài; mỗi người 30 câu/ngày; không có OpenAI
  thì trợ lý không trả lời (báo rõ và gợi ý tính năng không cần AI).

### 2.6. Báo cáo

- "Dùng" và "bỏ đi" đếm theo **số lần** (dòng lịch sử kho), không theo khối lượng; tỉ lệ dùng trước hạn vì vậy coi mỗi lần như nhau.
- Thực phẩm không có hạn được coi là dùng trước hạn. Tiền lãng phí chỉ tính món có đơn giá và ghi rõ "ước tính trên N món có giá".
- Báo cáo chỉ đúng khi người dùng chọn đúng lý do khi xóa; lịch sử trước khi có tính năng (chưa có lý do, chưa chụp nhóm/hạn) không tính.

### 2.7. Cộng đồng

- **Không làm "theo dõi thành viên"** (UC25 khảo sát có nút giả): đề tài tập trung vào quản lý thực phẩm, giảm lãng phí và dinh dưỡng cá
  nhân hóa; mạng xã hội theo dõi người dùng nằm ngoài trọng tâm, chỉ giữ lưu bài (UC25) và yêu thích công thức (UC24) vì phục vụ nấu ăn.
- Lưu bài và yêu thích chỉ người chủ tài khoản thấy; chưa có thư mục/nhãn để sắp xếp bài đã lưu.

### 2.8. Giao diện và thời gian

- Ngày từ server (hạn sử dụng, ngày thực đơn) hiển thị theo múi giờ máy người dùng; ở múi giờ âm (vd. châu Mỹ) có thể lệch về ngày hôm
  trước. Lịch tuần, báo cáo, nhắc hạn tính theo giờ Việt Nam.
- Bảng tin cộng đồng chỉ tải 30 bài mới nhất, chưa phân trang; lịch sử chat hiện 50 tin gần nhất.
- Ô chọn công thức khi đăng bài lọc ở trình duyệt trên toàn bộ danh sách món (đủ với 33 món, cần chuyển sang tìm ở backend khi nhiều món).
- Lượng nước ở Tổng quan chỉ ghi nhận trong lần xem, chưa lưu vào tài khoản.
- **Chỉ có giao diện sáng** (bỏ chế độ tối 12/11/2026): máy để chế độ tối vẫn thấy giao diện sáng. Lý do: mỗi màn hình, trạng thái
  và ảnh món phải kiểm hai lần (tương phản, biểu đồ, trang chủ có bộ màu riêng), dễ sót lỗi trong thời gian còn lại; ưu tiên một giao
  diện sáng đã kiểm kỹ.

## 3. Hướng phát triển

- **Lượng nước** theo ngày lưu vào tài khoản; thành viên/chủ đề nổi bật tính từ dữ liệu thật.
- **Theo dõi thành viên** (bảng tin theo người mình theo dõi, thông báo khi họ đăng bài).
- Cộng đồng: tab "Dành cho bạn" (gợi ý bài theo khẩu vị, R9), phân trang bảng tin.
- **Đăng nhập Google (OAuth)**: tùy chọn ở giai đoạn 6, chưa làm.
- **Chế độ tối**: thêm lại bộ token tối (theo `prefers-color-scheme` + nút chuyển, nhớ lựa chọn), kiểm tương phản bằng test
  `contrast.test.ts` cho cả hai bộ, chụp so sánh mọi trang ở cả hai chế độ.
- Các chức năng đã gỡ khỏi giao diện vì chưa có xử lý thật: giọng nói, đính kèm tệp trong chat AI, bình chọn (poll) trong bài viết.
- Đánh giá OCR trên ≥ 10 hóa đơn thật, so sánh Tesseract và OpenAI (độ đúng, thời gian, chi phí); đọc nhãn sản phẩm có HSD.
- Nhận diện dị ứng theo thành phần (cơ sở dữ liệu nguyên liệu có thành phần ẩn) thay vì chỉ theo tên.
- Nâng các gói phụ thuộc bản lớn (mục 1.1) trên nhánh riêng; chuyển trạng thái trong bộ nhớ sang Redis để chạy nhiều tiến trình.
- Thông báo đẩy (web push) cho nhắc hạn, thay hoặc bổ sung email.
