# Hạn chế, rủi ro đã biết và hướng phát triển

Tài liệu cho báo cáo đồ án. Bản đầy đủ (hạn chế về dữ liệu, thuật toán, giao diện) viết ở R10; các mục dưới đây ghi từ GĐ4.

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

## 2. Hướng phát triển


- **Đăng nhập Google (OAuth)**: tùy chọn ở giai đoạn 6, chưa làm.
