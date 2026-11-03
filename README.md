# NOURI AI

Ứng dụng quản lý thực phẩm và lập kế hoạch bữa ăn thông minh, hướng đến giảm lãng phí thực phẩm, cân bằng dinh dưỡng và cá nhân hoá khẩu vị.

## Kiến trúc

```text
Food_App/
├── frontend/                 # React + TypeScript + Vite
│   └── src/
│       ├── api/              # HTTP client
│       ├── components/       # UI dùng chung
│       ├── contexts/         # Auth state
│       ├── layouts/          # App shell
│       ├── pages/            # Dashboard, pantry, meal plan, AI...
│       └── types/            # Kiểu dữ liệu dùng chung
├── backend/                  # Node.js + Express + TypeScript
│   ├── prisma/               # PostgreSQL schema và seed
│   └── src/
│       ├── config/           # Biến môi trường
│       ├── controllers/      # HTTP handlers
│       ├── middleware/       # Auth, validation, errors
│       ├── routes/           # REST API
│       ├── services/         # Nghiệp vụ và OpenAI
│       └── utils/            # Tiện ích
├── docs/                     # Tài liệu kiến trúc và API
└── docker-compose.yml        # PostgreSQL local
```

## Chức năng chính

- Đăng ký, đăng nhập và hồ sơ dinh dưỡng cá nhân.
- Quản lý kho thực phẩm, số lượng, hạn sử dụng và cảnh báo sắp hết hạn.
- Quản lý công thức cùng thành phần dinh dưỡng.
- AI lập thực đơn theo mục tiêu calo, chế độ ăn, dị ứng, khẩu vị và thực phẩm sẵn có.
- Tự động tạo danh sách mua sắm từ phần nguyên liệu còn thiếu.
- Trợ lý AI trả lời câu hỏi dinh dưỡng dựa trên hồ sơ và kho thực phẩm.
- Dashboard theo dõi dinh dưỡng, thực phẩm sắp hết hạn và mức độ tận dụng nguyên liệu.

## Chạy dự án

1. Sao chép `.env.example` (thư mục gốc) thành `.env` và điền `POSTGRES_PASSWORD`, `JWT_SECRET`; file này được `docker compose` đọc và không được commit.
2. Sao chép `backend/.env.example` thành `backend/.env`; `DATABASE_URL` dùng cùng mật khẩu với `POSTGRES_PASSWORD`, điền `OPENAI_API_KEY` nếu muốn dùng AI thật.
3. Chạy PostgreSQL: `docker compose up -d postgres`.
4. Cài dependencies tại thư mục gốc: `npm install`.
5. Khởi tạo database: `npm run db:migrate && npm run db:seed`.
6. Chạy cả frontend và backend: `npm run dev`.

Frontend mặc định ở `http://localhost:5173`, API ở `http://localhost:4000`. Nếu không có OpenAI key, hệ thống dùng bộ lập kế hoạch dự phòng theo quy tắc để vẫn demo được.

Tài khoản dữ liệu mẫu sau khi chạy seed: `demo@nouri.vn` / `Demo@123`.

### Chạy hoàn toàn bằng Docker

Cần file `.env` ở thư mục gốc (bước 1 ở trên); thiếu biến thì `docker compose` dừng và báo tên biến.

```bash
docker compose up -d --build
docker exec app_food-backend-1 node dist/prisma/seed.js
```

Mở `http://localhost:8080`. Migration PostgreSQL được chạy tự động khi backend khởi động.

### Đặt lại dữ liệu demo (chạy trước buổi demo)

Tài khoản `demo@nouri.vn` được đưa về trạng thái chuẩn: xóa thực đơn, bài viết (kèm ảnh trên Cloudinary), bình luận,
lượt thích, tin nhắn trợ lý, lịch sử kho, thông báo và kho của demo; tạo lại hồ sơ mẫu và kho mẫu với hạn sử dụng tính từ
ngày chạy (giờ Việt Nam): một món còn 1 ngày, một món còn 2 ngày, các món khác 5–10 ngày, một món dưới mức tối thiểu.
Không đụng tới 33 món, tài khoản Admin và người dùng thật khác.

Lệnh cũng tạo **dữ liệu mẫu** cho thuật toán gợi ý (không phải hoạt động thật):

- **Lịch sử mẫu của demo**, khoảng 2 tuần trước ngày chạy: một thực đơn đã qua với 12 bữa "đã ăn" theo một khẩu vị nhất quán
  (món Việt, thích món cá, vài món Nhật) và 3 lượt thích bài của tài khoản mẫu. Các bữa này được đánh dấu "chỉ đánh dấu, không
  trừ kho" nên không có lịch sử kho. Nhờ vậy demo không rơi vào "khởi đầu lạnh" của bộ gợi ý.
- **8 tài khoản mẫu minh họa** (`mau1–8@nouri.vn`, "Người dùng mẫu N") được tạo lại: không đăng nhập được, không tính vào
  thống kê Admin. Xem [docs/thuat-toan-goi-y.md](docs/thuat-toan-goi-y.md).

```bash
docker compose exec backend npm run demo:reset -- --yes   # trong container (bản build)
npm run demo:reset:dev -w backend -- --yes                 # máy dev (tsx)
```

Không có `--yes` thì lệnh hỏi xác nhận (gõ `dat lai`); không có terminal để hỏi thì lệnh dừng, không xóa gì.
Seed (`db:seed`) chỉ tạo kho mẫu (kèm lịch sử mẫu, nếu demo chưa có thực đơn) khi kho demo đang trống, và chỉ tạo tài khoản
mẫu khi còn thiếu; không ghi đè dữ liệu đã có.

### Nghiệm thu bằng Playwright (`e2e/acceptance/`)

Mỗi lượt có một script nghiệm thu (UI-1 → UI-12, GĐ3b lượt 2–7, GĐ3b-R4 → R7). Cần frontend Vite ở `http://localhost:5173`
(`npm run dev -w frontend`), backend ở `http://localhost:4000` (Docker hoặc `npm run dev -w backend`) và trình duyệt Chromium
cho Playwright (`npx playwright-core install chromium` nếu máy chưa có). Tài khoản đọc từ biến môi trường hoặc `.env` ở gốc repo,
không có giá trị mặc định trong mã: `DEMO_EMAIL`, `DEMO_PASSWORD` (tài khoản demo của seed), `ADMIN_EMAIL`, `ADMIN_PASSWORD`
(script có thao tác Admin).

```bash
npm run e2e:acceptance -- r7-check                 # ảnh ghi vào e2e/output/r7-check/
npm run e2e:acceptance -- gd3b-l7-check docs/design/screens/GD3b-L7   # chọn thư mục ảnh
```

Một số script tạo/xóa dữ liệu thử hoặc chạy `demo:reset` (ghi rõ ở đầu file); script lượt UI cũ so với bản `main` ở
`http://localhost:8080` và có thể cần tham số thêm (xem dòng đầu mỗi file). Chạy `npm run e2e:acceptance` không tham số để xem danh sách.

Xem thêm [kiến trúc](docs/ARCHITECTURE.md) và [danh sách API](docs/API.md).
