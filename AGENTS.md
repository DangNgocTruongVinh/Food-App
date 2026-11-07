# Hướng dẫn làm việc với Nouri

## Nguồn sự thật và kiến trúc

- Nguồn sự thật: `CLAUDE.md` và `REPORT_NOURI.md`.
- Backend theo luồng `route → controller → service → Prisma`.
- Frontend dùng `features/*/*.api.ts`, component theo `components/<module>/`,
  thành phần dùng chung ở `components/ui/`.
- CSS dùng token trong `styles/ui/tokens.css`.

## Phạm vi không được sửa

- Không sửa `backend/src/modules/recommendation/` (công thức, trọng số),
  `scripts/eval-recommendation.ts`, `docs/thuat-toan-goi-y.md` hoặc
  `docs/design/DESIGN.md`.
- Ngoại lệ duy nhất: khi việc yêu cầu, được chuyển `asWords` sang backend;
  câu chữ đầu ra phải giống hệt, test cũ phải đạt, không đổi công thức,
  trọng số hoặc thứ tự xếp hạng.
- Không đổi `schema.prisma`, không tạo migration, không chạy
  `prisma migrate`/`db push`; database dùng chung với `main`.

## Bảo mật và vận hành

- Nhánh gốc của công việc này là `giai-doan-3b`; `main` đang cũ.
- Không merge vào `main`; mọi thay đổi chỉ làm trên `codex-tuan-45`.
- Không commit `.env`, không in mật khẩu/khóa.
- Không chạy `docker volume prune`, `docker system prune --volumes` hoặc
  `docker compose down -v`.
- Không tự chạy `demo:reset`; nếu cần phải hỏi người dùng trước.
- Sau mọi thay đổi backend: chạy `docker compose up -d --build`, rồi thử đăng
  nhập tại `http://localhost:8080`.

## Kiểm tra và giao diện

- Mỗi phần một commit; trước mỗi commit phải chạy test, typecheck và build,
  tất cả đều đạt.
- Giao diện dùng tiếng Việt, tuân luật “không giống AI” trong DESIGN.md:
  không emoji, không gradient, không chữ tiếng Anh.
- Cuối mỗi việc ghi 3–6 dòng vào `docs/lich-su-giai-doan.md`, mục
  “Việc do Codex làm”, gồm việc, commit và số test.
