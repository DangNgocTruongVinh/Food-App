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
  (Quy tắc chặt hơn CLAUDE.md có chủ đích cho Codex: cần migration thì báo để Claude làm.)
- C5 (script ảnh món) và C6 (tài liệu quyển) chạy song song với Claude: chỉ sửa trong `docs/` và `scripts/`
  (kể cả `backend/scripts/`), không đụng mã ứng dụng.

## Bảo mật và vận hành

- Codex làm trên nhánh `codex/<tên việc>` tách từ `main`, không tự merge; Claude rà rồi mới merge. Chỉ merge vào `main` khi test, typecheck, build đều qua và tính năng đã được kiểm tra thực tế (không chỉ test giả lập).
- Không commit `.env`, không in mật khẩu/khóa.
- Không chạy `docker volume prune`, `docker system prune --volumes` hoặc
  `docker compose down -v`.
- Không tự chạy `demo:reset`; nếu cần phải hỏi người dùng trước.
  (Chặt hơn CLAUDE.md có chủ đích: CLAUDE.md cho Claude chạy ở cuối lượt khi demo chỉ có dữ liệu mẫu.)
- Sau mọi thay đổi backend: chạy `docker compose up -d --build`, rồi thử đăng
  nhập tại `http://localhost:8080`.

## Kiểm tra và giao diện

- Mỗi phần một commit; trước mỗi commit phải chạy test, typecheck và build,
  tất cả đều đạt.
- Giao diện dùng tiếng Việt, tuân luật “không giống AI” trong DESIGN.md:
  không emoji, không gradient, không chữ tiếng Anh.
- Cuối mỗi việc ghi 3–6 dòng vào `docs/lich-su-giai-doan.md`, mục
  “Việc do Codex làm”, gồm việc, commit và số test.
