# Triển khai thật

Hướng dẫn chạy NOURI trên một máy chủ có người dùng thật, bằng `docker compose` như khi phát triển. Mọi biến đặt trong file `.env`
ở thư mục gốc (sao chép từ `.env.example`, không commit). Ý nghĩa từng biến ghi ngay trong `.env.example`.

## 1. Biến môi trường

### Bắt buộc

| Biến | Giá trị |
|------|---------|
| `POSTGRES_PASSWORD` | Mật khẩu database, chỉ chữ và số, dài (≥ 24 ký tự). Thiếu thì `docker compose` dừng. |
| `JWT_SECRET` | Chuỗi ngẫu nhiên ≥ 32 ký tự (vd. `openssl rand -base64 48`). Thiếu thì `docker compose` dừng. Đổi giá trị thì mọi phiên đăng nhập hết hiệu lực. |
| `FRONTEND_URL` | Địa chỉ HTTPS người dùng mở, vd. `https://nouri.example.vn` (CORS và liên kết trong email đặt lại mật khẩu). Để trống thì là `http://localhost:8080`, chỉ đúng khi chạy trên máy. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tài khoản Admin do seed tạo (mật khẩu ≥ 8 ký tự). Sau lần seed đầu có thể xóa khỏi `.env`; seed lần sau không đổi mật khẩu đã có. |

### Phải để mặc định

| Biến | Giá trị khi triển khai thật |
|------|-----------------------------|
| `SEED_DEMO` | Để trống hoặc `false`: không tạo tài khoản demo và tài khoản mẫu (mật khẩu biết trước), `demo:reset` từ chối chạy. |
| `DEMO_PASSWORD` | Để trống. Chỉ dùng trên máy demo (cùng `SEED_DEMO=true`). |
| `COOKIE_SECURE` | Để trống: cookie đăng nhập chỉ gửi qua HTTPS. Không đặt `false` trên máy chủ thật. |
| `SEED_UPDATE_RECIPES` | Để trống: seed không ghi đè chỉnh sửa của Admin trên các món gốc. |

### Tùy chọn (thiếu thì tính năng đó tắt, phần còn lại vẫn chạy)

- `OPENAI_API_KEY` (cùng `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_MODERATION_MODEL`): thực đơn bằng AI, Hỏi Nouri, đọc hóa đơn
  bằng AI, kiểm duyệt bài cộng đồng. Không có thì dùng bộ tạo thuật toán và chế độ đọc hóa đơn dự phòng.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (đủ cả ba): tải ảnh bài viết và ảnh món.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`: email quên mật khẩu và nhắc hạn dùng. Không có thì email chỉ ghi ra log.
- `AI_CHAT_DAILY_LIMIT`, `RECEIPT_SCAN_DAILY_LIMIT`, `EXPIRY_EMAIL_TIME`: giới hạn mỗi ngày và giờ gửi nhắc hạn.
- `DEMO_EMAIL_INBOX`: chỉ dùng cho máy demo.

## 2. HTTPS là bắt buộc

Cookie giữ đăng nhập (refresh token) mang cờ `Secure`: trình duyệt chỉ gửi qua HTTPS (hoặc `localhost`). Mở bằng `http://` qua tên miền
hay IP thì đăng nhập được nhưng tải lại trang là mất phiên. Mật khẩu và token cũng không được đi qua mạng dưới dạng chữ thường.

Cách làm: đặt một reverse proxy có chứng chỉ TLS (Caddy, nginx + Let's Encrypt, hoặc proxy của nhà cung cấp) trước cổng `8080` của
container `frontend`, chuyển `https://<tên miền>` → `http://127.0.0.1:8080`, rồi:

1. Đặt `FRONTEND_URL=https://<tên miền>` trong `.env`.
2. Chỉ mở cổng 443 (và 80 để chuyển hướng) ra ngoài; không mở 8080, 4000, 5432. Backend (4000) và PostgreSQL (5432) đã chỉ nghe trên
   `127.0.0.1` trong `docker-compose.yml`. Nên sửa cổng frontend thành `"127.0.0.1:8080:80"` để chỉ proxy gọi được.
3. Thêm một proxy phía trước thì backend nhận request qua hai proxy: sửa `TRUST_PROXY: 1` thành `TRUST_PROXY: 2` trong
   `docker-compose.yml` để giới hạn tần suất đọc đúng IP người dùng. Proxy ngoài phải ghi đè (không nối thêm) `X-Forwarded-For` bằng IP
   thật của người dùng.

## 3. Chạy lần đầu

```bash
docker compose up -d --build                         # migration áp tự động khi backend khởi động (prisma migrate deploy)
docker compose exec backend node dist/prisma/seed.js # danh mục, công thức, tài khoản Admin (không tạo demo khi SEED_DEMO tắt)
```

Kiểm tra: `GET https://<tên miền>/api/health` trả `status: ok` và cho biết email đã cấu hình chưa. Đăng nhập Admin,
đổi mật khẩu nếu `ADMIN_PASSWORD` đã từng nằm ở nơi khác ngoài `.env`.

Cập nhật phiên bản mới: sao lưu database (mục 4), `git pull`, rồi `docker compose up -d --build`. Migration mới áp khi backend khởi
động; không chạy `prisma migrate dev` trên database này.

## 4. Sao lưu database

Database tên `nutriplan`, người dùng `nutriplan`, nằm trong volume Docker `nutriplan_postgres`. Xóa volume (`docker compose down -v`)
là mất toàn bộ dữ liệu.

Sao lưu (chạy được khi ứng dụng đang chạy; file chứa dữ liệu người dùng, cất ngoài máy chủ và không commit):

```bash
docker compose exec -T postgres pg_dump -U nutriplan -d nutriplan --no-owner > backup-$(date +%Y%m%d-%H%M).sql
```

- Sao lưu trước mỗi lần cập nhật có migration mới, và định kỳ (vd. mỗi ngày bằng cron), giữ vài bản gần nhất.
- Kiểm tra bản sao lưu: file không rỗng và có các dòng `CREATE TABLE`.

Khôi phục vào database trống (vd. máy chủ mới, sau `docker compose up -d postgres`):

```bash
docker compose exec -T postgres psql -U nutriplan -d nutriplan < backup-20261123-2302.sql
docker compose up -d backend frontend
```

Khôi phục đè lên database đang có dữ liệu thì phải dừng backend, xóa và tạo lại database `nutriplan` trước (`dropdb`/`createdb` trong
container `postgres`), rồi chạy lệnh trên.

Ảnh (bài viết, ảnh món) nằm trên Cloudinary, không nằm trong bản sao lưu này.
