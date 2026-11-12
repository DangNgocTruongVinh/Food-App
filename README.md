# NOURI

Ứng dụng quản lý thực phẩm trong gia đình và lập kế hoạch bữa ăn/dinh dưỡng cá nhân hóa, hướng đến giảm lãng phí thực phẩm,
cân bằng dinh dưỡng và hợp khẩu vị (đồ án tốt nghiệp).

**Công nghệ:** React 19 + Vite + TypeScript + React Query (frontend, nginx khi chạy Docker) · Express 5 + Prisma 6 + Zod (backend)
· PostgreSQL 16 · OpenAI, Cloudinary, SMTP là dịch vụ ngoài **tùy chọn** (thiếu thì ứng dụng vẫn chạy bằng nhánh dự phòng).

## Chức năng chính

- Đăng ký, đăng nhập (access token 15 phút + refresh token), quên/đặt lại mật khẩu qua email, hồ sơ dinh dưỡng.
- Kho thực phẩm: số lượng, hạn, đơn giá, lịch sử thay đổi; quét hóa đơn (OpenAI Vision hoặc Tesseract dự phòng); nhắc hạn qua email.
- Thực đơn 7 ngày (OpenAI, hoặc bộ tạo chấm điểm khi không có AI), danh sách đi chợ, "Đã ăn" trừ kho, "Đã mua" vào kho.
- 33 công thức, tìm kiếm không dấu theo tên/nguyên liệu/ẩm thực, gợi ý cá nhân hóa (lọc an toàn dị ứng/chế độ ăn), món yêu thích.
- Cộng đồng: bài viết kèm ảnh và công thức, AI kiểm duyệt; Trợ lý AI "Hỏi Nouri"; Báo cáo lãng phí và dinh dưỡng tuần.
- Khu Admin: thống kê, công thức (ẩn, xóa hẳn/xóa mềm, khôi phục), người dùng (khóa/mở khóa), kiểm duyệt, nhật ký thao tác.

## Cấu trúc

```text
App_Food/
├── frontend/src/      # pages/ (ghép component), components/<module>/, features/<module>/ (*.api.ts, *.logic.ts + test), styles/ui/
├── backend/
│   ├── prisma/        # schema.prisma, migrations/, seed.ts, demo-reset.ts (dữ liệu demo)
│   ├── scripts/       # eval-recommendation, eval-meal-plan, eval-receipt-ocr, upload-recipe-photos
│   └── src/modules/   # mỗi module: *.routes.ts → *.controller.ts → *.service.ts → Prisma; *.schema.ts (Zod); *.test.ts
├── e2e/acceptance/    # script Playwright (luồng demo, chụp ảnh màn hình, nghiệm thu từng lượt cũ)
├── docs/              # tài liệu (bao-cao/: API, ERD, use case, số liệu, ảnh màn hình; thuat-toan-goi-y.md; han-che.md…)
└── docker-compose.yml # postgres + backend + frontend (nginx)
```

## Cài đặt và chạy từ đầu (máy mới, Docker)

Cần: **Docker Desktop** (có Docker Compose), **Node.js 20+** và npm (để chạy test, đánh giá, script Playwright), Git.

1. Lấy mã và cài thư viện (cho test/đánh giá chạy trên máy):

   ```bash
   git clone <địa chỉ repo> App_Food && cd App_Food
   npm install
   ```

2. Tạo file biến môi trường ở thư mục gốc: sao chép `.env.example` thành `.env` rồi điền. **Không commit `.env`.**
   - Bắt buộc: `POSTGRES_PASSWORD` (chỉ chữ và số), `JWT_SECRET` (chuỗi ngẫu nhiên ≥ 32 ký tự).
   - Nên có: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed tạo tài khoản Admin; không có thì không có Admin).
   - Tùy chọn: `OPENAI_API_KEY` (thực đơn/chat/quét hóa đơn bằng AI), `CLOUDINARY_*` (tải ảnh), `SMTP_*` + `MAIL_FROM` (email),
     `DEMO_EMAIL`/`DEMO_PASSWORD` (chỉ cho script Playwright). Ý nghĩa từng biến ghi ngay trong `.env.example`.

3. Build và chạy (migration cơ sở dữ liệu tự áp khi backend khởi động):

   ```bash
   docker compose up -d --build
   ```

4. Tạo dữ liệu gốc (33 món, tài khoản Admin, tài khoản demo và kho mẫu) — chạy một lần; chạy lại không tạo trùng:

   ```bash
   docker compose exec backend node dist/prisma/seed.js
   ```

5. Đưa tài khoản demo về trạng thái chuẩn (nên chạy trước mỗi buổi demo, xem mục dưới):

   ```bash
   docker compose exec backend npm run demo:reset -- --yes
   ```

6. Mở **http://localhost:8080**. API ở `http://localhost:4000/api` (chỉ nghe trên máy, kiểm tra `GET /api/health`).

**Tài khoản:** demo `demo@nouri.vn` / `Demo@123` (dữ liệu mẫu, dùng khi trình bày); Admin là `ADMIN_EMAIL`/`ADMIN_PASSWORD` trong `.env`.

**Ảnh món:** seed chưa có ảnh món thật; Admin tải ảnh ở *Admin → Công thức → Sửa*, hoặc dùng `npm run upload:recipe-photos`
(cần `CLOUDINARY_*`, xem [docs/anh-mon-can-tim.md](docs/anh-mon-can-tim.md)).

Không có `OPENAI_API_KEY`: thực đơn dùng bộ tạo chấm điểm, chat AI báo chưa cấu hình, quét hóa đơn dùng Tesseract. OpenAI lỗi
hoặc quá 120 giây khi tạo thực đơn thì backend cũng tự chuyển sang bộ tạo dự phòng.

### Chạy khi phát triển (không build Docker cho frontend/backend)

```bash
docker compose up -d postgres            # chỉ cơ sở dữ liệu
cp backend/.env.example backend/.env     # điền DATABASE_URL (localhost:5432, cùng mật khẩu POSTGRES_PASSWORD), JWT_SECRET…
npm run db:seed                           # sau khi backend đã áp migration
npm run dev                               # frontend http://localhost:5173 (proxy /api → 4000), backend http://localhost:4000
```

### Đặt lại dữ liệu demo (`demo:reset`)

Chỉ tác động `demo@nouri.vn`: xóa thực đơn, bài viết (kèm ảnh Cloudinary), bình luận, lượt thích, tin nhắn trợ lý, lịch sử kho,
lượt quét hóa đơn, thông báo và kho; tạo lại hồ sơ mẫu, kho mẫu 8 thực phẩm với hạn tính từ ngày chạy (giờ Việt Nam: Đậu hũ còn
1 ngày, Ức gà 2 ngày, các món khác 5–10 ngày, Trứng dưới mức tối thiểu), lịch sử mẫu ~2 tuần trước (12 bữa đã ăn, tránh "khởi đầu
lạnh" của bộ gợi ý), dữ liệu 8 tuần cho trang Báo cáo, 8 tài khoản mẫu `mau1–8@nouri.vn` (không đăng nhập được, không tính vào
thống kê Admin). Mở khóa và đặt lại tên/mật khẩu demo. **Không đụng** tới công thức, Admin, nhật ký Admin và người dùng thật khác.

```bash
docker compose exec backend npm run demo:reset -- --yes   # trong container
npm run demo:reset:dev -w backend -- --yes                 # máy dev (tsx)
```

Không có `--yes` thì lệnh hỏi xác nhận (gõ `dat lai`); không có terminal thì dừng, không xóa gì.

**Món đã bị Admin xóa mềm** (món đã có trong thực đơn/bài viết nên không xóa hẳn được): seed không tạo lại và không tạo trùng
(món vẫn còn dòng theo đường dẫn), kể cả khi `SEED_UPDATE_RECIPES=true` cũng không bỏ trạng thái xóa; `demo:reset` chỉ dùng món
còn dùng được, bữa mẫu của món đã xóa được bỏ qua (không lỗi). Muốn dùng lại món: *Admin → Công thức → Đã xóa → Khôi phục*.

## Kiểm thử

```bash
npm test                     # toàn bộ test backend + frontend (Vitest, không cần cơ sở dữ liệu)
npm run typecheck            # kiểm tra kiểu TypeScript cả hai phía
npm run build                # build backend + frontend
npm run test:perf -w backend # đo hiệu năng bộ gợi ý
```

## Đánh giá thuật toán (dữ liệu mô phỏng, chạy trong bộ nhớ)

```bash
npm run eval:recommend -w backend   # bộ gợi ý: so 3 thuật toán và bộ trộn (docs/thuat-toan-goi-y.md)
npm run eval:mealplan -w backend    # bộ tạo thực đơn dự phòng (mục 9 docs/thuat-toan-goi-y.md)
npm run eval:receipt -w backend     # quét hóa đơn: cần ảnh thật trong docs/test-evidence/receipts/ (không commit) + đáp án .json
```

## Script Playwright (`e2e/acceptance/`)

Cần Docker đang chạy (app `http://localhost:8080`, API `http://localhost:4000`) và Chromium cho Playwright
(`npx playwright-core install chromium`). Tài khoản đọc từ biến môi trường hoặc `.env` ở gốc: `DEMO_EMAIL`, `DEMO_PASSWORD`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD` (không có giá trị mặc định trong mã, không in mật khẩu).

```bash
npm run e2e:acceptance -- demo-flow             # luồng demo: đăng nhập → kho → quét hóa đơn (dự phòng) → thực đơn → đã ăn
                                                #   → báo cáo → gợi ý → tìm kiếm → Admin. Tạo 1 thực đơn: chạy demo:reset sau đó.
npm run e2e:acceptance -- screenshots docs/bao-cao/anh-man-hinh   # ảnh màn hình cho quyển (chạy ngay sau demo:reset)
npm run e2e:acceptance -- landing-header-check  # đo header trang chủ 1024–1279px khi đã đăng nhập (không chụp ảnh)
```

Các script theo lượt cũ (`gd3b-*`, `r2`–`r7`, `ui1`–`ui12`) là bằng chứng nghiệm thu từng giai đoạn, viết cho giao diện lúc đó:
**lỗi thời**, không bảo trì (trình chạy in cảnh báo). Chạy `npm run e2e:acceptance` không tham số để xem danh sách.

## Tài liệu

[Kiến trúc](docs/ARCHITECTURE.md) · [API](docs/bao-cao/api.md) · [ERD](docs/bao-cao/erd.md) · [Use case](docs/bao-cao/use-case.md)
· [Số liệu](docs/bao-cao/so-lieu.md) · [Ảnh màn hình](docs/bao-cao/anh-man-hinh/README.md) · [Thuật toán gợi ý](docs/thuat-toan-goi-y.md)
· [Hạn chế](docs/han-che.md) · [Lịch sử giai đoạn](docs/lich-su-giai-doan.md).
