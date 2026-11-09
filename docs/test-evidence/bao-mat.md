# Bảo mật tài khoản và API (GĐ4 + C3)

Ngày kiểm: 10/11/2026, nhánh `giai-doan-4`. Kiểm bằng test tự động (không có DB thật, Prisma giả lập) và đọc mã; chưa thử trên
trình duyệt thật (xem "Việc cần kiểm tra tay").

## 1. Đã kiểm và kết quả

| Hạng mục | Cách làm | Kết quả / bằng chứng |
|---|---|---|
| Header bảo mật | `helmet()` mặc định ở `backend/src/app.ts` (CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, ẩn `X-Powered-By`) | Có từ trước, giữ nguyên |
| CORS | Chỉ `FRONTEND_URL` trong `.env`, `credentials: true` để gửi cookie | Có từ trước, giữ nguyên |
| Rate limit | `middleware/rate-limit.ts`: 20 lần/phút/IP, dùng chung cho `POST /api/auth/login` và `/register`; quá → 429 + `Retry-After` | Test `refresh-token.test.ts`: lần 21 trả 429; `/refresh` không bị tính |
| IP sau proxy | `TRUST_PROXY` (Docker = 1, vì request đi qua nginx của frontend) để `req.ip` lấy từ `X-Forwarded-For` | Cấu hình ở `docker-compose.yml` |
| Kích thước body | `express.json({ limit: "100kb" })` (JSON hợp lệ lớn nhất ~20 KB); ảnh multipart ≤ 5 MB (`image-upload.ts`), nginx ≤ 6 MB | Test: body 110 KB → 413 |
| JSON hỏng / body quá lớn | `error-handler.ts` trả 400/413 với thông báo ngắn (trước đây rơi vào 500) | Test: JSON hỏng → 400 |
| Zod cho mọi route nhận dữ liệu | Rà 33 route POST/PUT/PATCH/DELETE ở `modules/*/*.routes.ts` | Cả 33 đều có `validate(schema)`; `/refresh`, `/logout` dùng schema rỗng `strict()` |
| Không lộ stack trace | `errorHandler` chỉ trả `{ message }` chung cho lỗi 500, chi tiết ghi `console.error` phía server | Đúng ở mọi môi trường (không phụ thuộc `NODE_ENV`) |
| `npm audit` | `npm audit fix` (không `--force`) | 18 → 9 lỗ hổng (xem mục 3) |

## 2. Phiên đăng nhập: access token + refresh token

- **Access token** (JWT, 15 phút) trong body phản hồi; frontend giữ ở `localStorage` (nhớ đăng nhập) hoặc `sessionStorage` (không nhớ),
  logic chọn kho ở `auth.storage.ts` (quyết định #11).
- **Refresh token**: 32 byte ngẫu nhiên, chỉ nằm trong cookie `nouri_refresh`: `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` khi
  production (`COOKIE_SECURE` ghi đè được). "Nhớ đăng nhập": cookie 30 ngày (tính từ lần làm mới gần nhất); không tick: cookie phiên
  (phía server hết hạn sau 1 ngày không dùng). Đăng ký xong mặc định nhớ.
- **Lưu dạng băm**: bảng `RefreshToken` (migration `20261110000000_add_refresh_tokens`) chỉ có SHA-256 của token.
- **Xoay vòng**: mỗi `POST /api/auth/refresh` đánh dấu token cũ `usedAt`, phát token mới cùng `familyId`.
- **Phát hiện dùng lại**: token đã xoay bị gửi lại sau 10 giây → thu hồi cả chuỗi (kẻ trộm và người dùng thật đều phải đăng nhập lại).
  Trong 10 giây (hai tab làm mới cùng lúc) chỉ trả 401 `REFRESH_RACE`, không thu hồi; tab thua gửi lại với cookie mới.
- **Thu hồi**: đăng xuất (`POST /api/auth/logout`, thu hồi chuỗi + xóa cookie); Admin khóa tài khoản (cùng transaction với khóa); đổi mật
  khẩu (`POST /api/auth/change-password`: thu hồi mọi refresh token, ghi `passwordChangedAt` nên access token phát trước đó bị
  `requireAuth` từ chối ngay; thiết bị đang đổi nhận phiên mới, giữ kiểu "nhớ đăng nhập"). Tài khoản bị khóa gọi refresh → 403
  `ACCOUNT_LOCKED` và thu hồi mọi token.
- **Frontend** (`api/client.ts`): gặp 401 ở request có access token → làm mới **một lần** (các request cùng lỗi dùng chung một lần làm
  mới), lưu token mới vào đúng kho đang dùng, gọi lại request. Làm mới thất bại → xóa phiên, về `/login`; bị khóa → `/login?locked=1`.
  401 của đăng nhập/đăng ký (sai mật khẩu) không làm mới.

Test (backend `modules/auth/refresh-token.test.ts` 11, `modules/auth/auth.test.ts`, `middleware/auth.test.ts`, `admin-users.test.ts`; frontend `client.test.ts` 6 mới,
`auth.logic.test.ts`): cookie đúng thuộc tính, DB không chứa token gốc, xoay vòng, dùng lại token cũ → thu hồi chuỗi, hai tab cùng lúc,
token thiếu/sai/hết hạn, đăng xuất, khóa tài khoản (refresh bị từ chối + Admin khóa thu hồi trong transaction), đổi mật khẩu (sai mật
khẩu hiện tại 400, phiên khác bị thu hồi, access token cũ bị từ chối), access hết hạn → tự làm mới rồi gọi lại, làm mới hỏng → đăng xuất
không lặp. Tổng: backend 1099/1099, frontend 432/432; typecheck, build đạt.

## 3. Việc còn lại

**Lỗ hổng `npm audit` cần nâng bản lớn — quyết định 10/11: không nâng trong đồ án, ghi ở `docs/han-che.md` mục 1.1:**

| Gói | Mức | Cần nâng | Ghi chú |
|---|---|---|---|
| `prisma`, `@prisma/client` (qua `@prisma/config` → `deepmerge-ts`) | cao | Prisma 7 | Thư viện của CLI, chạy lúc build/migrate, không nhận dữ liệu người dùng |
| `zod` | cao | Zod 4 | Đổi API (`flatten`, thông báo lỗi); ảnh hưởng mọi schema. Rủi ro thực tế thấp vì body ≤ 100 KB |
| `openai` | cao | openai 7 | Do phụ thuộc zod cũ |
| `sharp` | cao | 0.35 | Lỗ hổng ở libvips/libheif; ảnh đã chặn định dạng bằng byte đầu (jpg/png/webp) và ≤ 5 MB |
| `vitest` (+ `tinypool`, `@vitest/mocker`) | nghiêm trọng | Vitest 5 | Chỉ dùng khi chạy test (dev), không có trong bản chạy |

**Khác:**
- Quên/đặt lại mật khẩu qua email: không làm, ghi vào hướng phát triển (`docs/han-che.md` mục 2).
- Rate limit lưu trong bộ nhớ một tiến trình: khởi động lại thì mất bộ đếm; chạy nhiều tiến trình cần kho chung (Redis).
- ~~Cổng 4000 của backend mở ra mạng~~: đã sửa, `docker-compose.yml` chỉ nghe `127.0.0.1:4000` (máy khác không gọi thẳng được để giả
  `X-Forwarded-For`); trình duyệt gọi API qua nginx của frontend.
- Access token vẫn lưu ở web storage (đọc được bằng JavaScript nếu có XSS); chỉ sống 15 phút. Phương án chặt hơn: giữ trong bộ nhớ và làm
  mới khi tải trang.
- Đăng xuất chỉ thu hồi refresh token; access token đã phát còn dùng được tối đa 15 phút (khóa tài khoản và đổi mật khẩu thì bị chặn ngay).

## 4. Cách bảo vệ

- **XSS:** React tự thoát chuỗi khi hiển thị, mã không dùng `dangerouslySetInnerHTML`; CSP mặc định của helmet cho API; refresh token
  (thứ sống lâu) nằm trong cookie `HttpOnly` nên script không đọc được; access token chỉ 15 phút.
- **CSRF:** API xác thực bằng header `Authorization: Bearer` (trang khác không tự gửi được). Cookie refresh token `SameSite=Strict` (trình
  duyệt không gửi kèm request từ trang khác) và chỉ có ở `/api/auth`; CORS chỉ cho `FRONTEND_URL`, nên trang lạ không đọc được access token
  mà `/refresh` trả về.
- **Brute-force / dò tài khoản:** 20 lần/phút/IP cho đăng nhập và đăng ký; bcrypt cost 12; cùng một thông báo cho sai email/sai mật khẩu;
  kiểm mật khẩu trước khi báo tài khoản bị khóa.
- **Token bị lộ:** refresh token xoay vòng, phát hiện dùng lại thì thu hồi cả chuỗi; DB chỉ lưu bản băm nên lộ DB không dùng được token.

## 5. Việc cần kiểm tra tay (Docker, trình duyệt)

1. Đăng nhập có tick "Nhớ đăng nhập": DevTools → Application → Cookies có `nouri_refresh` (HttpOnly, Strict, Path `/api/auth`, hạn 30 ngày).
   Không tick: cookie không có hạn (Session).
2. Đợi quá 15 phút (hoặc xóa `nouri_token` rồi đặt giá trị cũ đã hết hạn) rồi thao tác: trang vẫn chạy, tab Network thấy `401` → `/auth/refresh` → gọi lại.
3. Đăng xuất rồi bấm Back: bị đưa về `/login`; gọi `/api/auth/refresh` bằng cookie cũ → 401.
4. Admin khóa tài khoản đang mở ở trình duyệt khác: thao tác tiếp → về `/login?locked=1`.
5. Hồ sơ → "Đổi mật khẩu": thiết bị khác bị đăng xuất ở lần làm mới kế tiếp; thiết bị đang dùng vẫn đăng nhập.
6. Đăng nhập sai 21 lần trong 1 phút → thông báo "Bạn thử quá nhiều lần...".
