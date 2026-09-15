# Bàn giao refactor V1: Auth + Profile

Ngày kiểm tra cuối: 13/09/2026. Phạm vi kết thúc ở Auth + Profile.
Không thêm tính năng, không đổi UI hoặc chủ động sửa hành vi nghiệp vụ V1.

## 1. File đã thay đổi

### Di chuyển và cập nhật (3 file)

| Đường dẫn cũ | Đường dẫn mới |
|---|---|
| `backend/src/routes/auth.routes.ts` | `backend/src/modules/auth/auth.routes.ts` |
| `backend/src/services/auth.service.ts` | `backend/src/modules/auth/auth.service.ts` |
| `backend/src/routes/profile.routes.ts` | `backend/src/modules/profile/profile.routes.ts` |

Các đường dẫn cũ đã bỏ; import trong `backend/src/app.ts` đã đổi.
Git chưa stage nên có thể hiển thị các file di chuyển thành deleted + untracked.

### Tạo mới (20 file, không tính 3 file di chuyển)

```text
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.schema.ts
backend/src/modules/auth/auth.test.ts
backend/src/modules/profile/profile.controller.ts
backend/src/modules/profile/profile.schema.ts
backend/src/modules/profile/profile.service.ts
backend/src/modules/profile/profile.test.ts
backend/src/middleware/http.test.ts
backend/src/test/http-test-utils.ts
frontend/src/api/client.test.ts
frontend/src/api/query-client.ts
frontend/src/api/query-keys.ts
frontend/src/features/auth/auth.api.ts
frontend/src/features/auth/auth.session.ts
frontend/src/features/auth/auth.storage.ts
frontend/src/features/auth/auth.test.ts
frontend/src/features/profile/profile.api.ts
frontend/src/features/profile/profile.queries.ts
frontend/src/features/profile/profile.test.ts
docs/REFACTOR_V1.md
```

### Sửa tại chỗ (14 file)

```text
package.json
backend/package.json
backend/src/app.ts
backend/src/types/http.ts
frontend/package.json
frontend/src/App.tsx
frontend/src/api/client.ts
frontend/src/contexts/AuthContext.tsx
frontend/src/main.tsx
frontend/src/types/index.ts
frontend/src/pages/ProfilePage.tsx
frontend/src/pages/MealPlansPage.tsx
frontend/src/pages/AiAssistantPage.tsx
docs/ARCHITECTURE.md
```

Ba `package.json` chỉ thêm script typecheck; không thêm dependency, không đổi lockfile.
MealPlansPage và AiAssistantPage chỉ đổi import và cách gọi query Profile.

### File và dữ liệu được giữ nguyên

Đã đối chiếu SHA-256 với thời điểm bắt đầu: `PantryPage.tsx`, `styles.css`,
`backend/prisma/schema.prisma`, `backend/prisma/seed.ts`, toàn bộ 3 migration SQL,
`migration_lock.toml` và `output/Nouri_Bao_cao_hien_trang_Use_Case.docx` không đổi.
Các thay đổi chưa commit của người dùng vẫn còn nguyên.
Không chạy generate/migrate/seed, không thao tác database thật.

## 2. Cấu trúc backend mới

```text
backend/src/
  app.ts
  modules/
    auth/
      auth.routes.ts
      auth.controller.ts
      auth.schema.ts
      auth.service.ts
      auth.test.ts
    profile/
      profile.routes.ts
      profile.controller.ts
      profile.schema.ts
      profile.service.ts
      profile.test.ts
  middleware/             # dùng lại auth, validate, error-handler
    http.test.ts
  services/
    nutrition.service.ts  # dùng lại, không sửa công thức
  test/
    http-test-utils.ts
  types/http.ts           # bổ sung ValidatedRequest<TBody>
```

Luồng: route → middleware → controller → service → Prisma.
Schema ở đây là schema validation Zod; Prisma schema không thay đổi.

## 3. Logic đã tách

| Module/lớp | Nội dung |
|---|---|
| Auth schema | Validation email, password, name; type đầu vào suy ra từ Zod. |
| Auth controller | Đọc body đã validate, gọi service, giữ register 201 và login 200. |
| Auth service | Di chuyển service đã có: chuẩn hóa email/name, kiểm tra trùng email, bcrypt cost 12, tạo User kèm Profile, kiểm tra mật khẩu, JWT hạn 7 ngày, public user response. Các nghiệp vụ này vốn đã ở service trước refactor. |
| Profile schema | Toàn bộ validation trường hồ sơ, giới hạn số, enum, array, optional và nullable chuyển khỏi route. |
| Profile controller | Lấy userId do requireAuth gắn vào request; truyền input cho service; trả JSON. |
| Profile service | Truy vấn hồ sơ, tách name khỏi profileInput, tính mục tiêu dinh dưỡng, transaction cập nhật User và upsert NutritionProfile, ghép response. |
| Route của cả hai module | Chỉ còn khai báo method/path, middleware và controller. |
| Frontend Auth | Tách API login/register và đọc/ghi/xóa phiên khỏi AuthContext; API interceptor và guard dùng chung helper lưu phiên. |
| Frontend Profile | Tách GET/PUT, chuyển số/null và danh sách dấu phẩy khỏi page; dùng chung query/mutation và invalidation Profile/Dashboard. |

Không thay response envelope hay bổ sung middleware mới: tiếp tục dùng chung
`requireAuth`, `validate`, `asyncHandler`, `HttpError`, `errorHandler` hiện có.
Lỗi vẫn truyền qua asyncHandler/errorHandler; frontend giữ nguyên getApiError và xử lý 401.

### Hợp đồng giữ nguyên

| API | Thành công | Lỗi đã kiểm tra |
|---|---|---|
| `POST /api/auth/register` | 201 `{ token, user: { id, email, name } }` | 409 email trùng; 422 validation |
| `POST /api/auth/login` | 200 `{ token, user: { id, email, name } }` | 401 sai thông tin; 422 validation |
| `GET /api/profile` | 200 `{ id, name, email, profile }`; user không tồn tại vẫn 200/null | 401 thiếu/sai/hết hạn token qua middleware |
| `PUT /api/profile` | 200 `{ id, name, email, profile }` | 401 thiếu token; 422 validation |

Giữ thông báo lỗi tiếng Việt và chi tiết validation. Profile dùng userId từ JWT,
không nhận quyền sở hữu từ body/query. Trường ngoài schema vẫn được loại bỏ như V1.
PUT một phần vẫn tính dinh dưỡng từ payload gửi lên, không đọc và merge hồ sơ cũ.

Frontend giữ key localStorage `nutriplan_token`/`nutriplan_user`, key query `['profile']`
và `['dashboard']`, staleTime 30 giây, retry 1. Sau lưu hồ sơ, invalidation vẫn
không chờ hoàn tất; thông báo thành công vẫn tự tắt sau 2,5 giây.

## 4. Kết quả kiểm tra

Mỗi bước chỉ chuyển tiếp sau khi typecheck, build và toàn bộ test của bước đó pass.

| Bước | Typecheck | Build | Toàn bộ test |
|---|---|---|---|
| Baseline ban đầu | PASS với lệnh TypeScript phù hợp tsconfig | PASS | 6 backend + 3 frontend = 9 |
| Bước 0: script và test giữ hợp đồng V1 | PASS | PASS | 35 backend + 3 frontend = 38 |
| Auth backend | PASS | PASS | 38 |
| Profile backend | PASS | PASS | 38 |
| Auth frontend | PASS | PASS | 35 backend + 18 frontend = 53 |
| Profile frontend/query | PASS | PASS | 35 backend + 26 frontend = 61 |
| Ổn định Auth + Profile | PASS | PASS | 36 backend + 32 frontend = 68 |

Lệnh kiểm tra tại thư mục gốc:

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
```

Bộ test gồm 9 file: 5 backend (36 test) và 4 frontend (32 test).
Giữ toàn bộ 9 test ban đầu và thêm 59 test về hợp đồng HTTP, validation,
JWT, mật khẩu, dữ liệu Prisma, HTTP interceptor, lưu phiên và cache Profile.
Backend dùng route/controller/service/middleware thật với Prisma được mock.
Frontend dùng Axios adapter và localStorage giả, cùng QueryClient/MutationObserver thật.
Không kiểm thử E2E bằng trình duyệt hoặc transaction/rollback trên PostgreSQL thật.

Đã so sánh AST: JSX trong ProfilePage, MealPlansPage và AiAssistantPage không đổi.
LoginPage, AppLayout và package-lock.json không đổi so với HEAD.
`git diff --check` cho các file refactor pass (Git có cảnh báo LF/CRLF của môi trường Windows).

Build frontend thành công: CSS 448,62 kB (gzip 83,53 kB), JS khoảng 685,64 kB
(gzip 218,58 kB). Cảnh báo chunk >500 kB đã tồn tại ở baseline (~685,04 kB).

Các lỗi trong quá trình chuẩn bị/refactor đã xử lý trước khi chuyển bước:
cấu hình lệnh typecheck composite/incremental; type Express ParamsDictionary;
khai báo type ProfileUpdateInput bị thiếu/trùng khi áp dụng patch; kỳ vọng test dinh dưỡng
được sửa thành 2085 đúng với công thức hiện có, không sửa business logic.
Build/test từng bị sandbox chặn ghi output/cache; chạy lại với quyền được duyệt đã pass.

## 5. Ổn định Auth + Profile và vấn đề còn lại

| Hạng mục | Trạng thái |
|---|---|
| Cache khi đổi phiên | Đã sửa: login/register và logout xóa toàn bộ QueryClient. |
| Logout | Đã sửa: xóa cache/storage, cập nhật AuthContext và redirect `/login` bằng React Router. |
| Đồng bộ tên sau lưu Profile | Đã sửa: response PUT cập nhật AuthContext và `nutriplan_user`, giữ nguyên token. |
| JSON phiên hỏng | Đã sửa: parse/kiểm tra shape an toàn; session lỗi được xóa và AuthProvider nhận `null`. |
| PUT Profile một phần | Đã sửa: đọc và merge NutritionProfile hiện tại trước khi tính target; đọc và ghi nằm trong cùng transaction. |
| Script production start backend | Đã sửa thành `node dist/src/server.js`, khớp output build hiện tại. |
| Bundle frontend lớn | Còn lại ngoài phạm vi: Vite cảnh báo chunk >500 kB; chưa chia bundle hoặc refactor module khác. |

Không có lỗi typecheck/build/test còn thất bại trong phạm vi đã kiểm tra.
Danh sách trên phản ánh các vấn đề xác định trong lần refactor này, không phải tuyên bố
đã kiểm thử đầy đủ mọi luồng nghiệp vụ của toàn bộ project.
