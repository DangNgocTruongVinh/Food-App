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

1. Sao chép `backend/.env.example` thành `backend/.env` và điền `OPENAI_API_KEY` nếu muốn dùng AI thật.
2. Chạy PostgreSQL: `docker compose up -d postgres`.
3. Cài dependencies tại thư mục gốc: `npm install`.
4. Khởi tạo database: `npm run db:migrate && npm run db:seed`.
5. Chạy cả frontend và backend: `npm run dev`.

Frontend mặc định ở `http://localhost:5173`, API ở `http://localhost:4000`. Nếu không có OpenAI key, hệ thống dùng bộ lập kế hoạch dự phòng theo quy tắc để vẫn demo được.

Tài khoản dữ liệu mẫu sau khi chạy seed: `demo@nutriplan.vn` / `Demo@123`.

### Chạy hoàn toàn bằng Docker

```bash
docker compose up -d --build
docker exec app_food-backend-1 node dist/prisma/seed.js
```

Mở `http://localhost:8080`. Migration PostgreSQL được chạy tự động khi backend khởi động.

Xem thêm [kiến trúc](docs/ARCHITECTURE.md) và [danh sách API](docs/API.md).
