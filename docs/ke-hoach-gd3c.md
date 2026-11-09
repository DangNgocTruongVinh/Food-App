# Kế hoạch GĐ3c — Nhập thực phẩm bằng quét hóa đơn

Trạng thái: **đã duyệt** (09/11/2026, nhánh `giai-doan-3c` tách từ `main`). Chưa có `OPENAI_API_KEY`:
phần 1 làm mọi thứ không cần key (Tesseract chạy trên server), phần 2 thêm OpenAI Vision khi có key.

## 0. Mã có sẵn được dùng lại

| Mã có sẵn | Dùng cho |
|---|---|
| `services/pantry-purchase.ts`: `suggestedPantryDefaults`, `choosePurchaseTarget` | nhóm, nơi bảo quản, hạn ước tính; chọn merge/reuse/create |
| `services/pantry-match.ts`, `dietary.service.ts` `normalizeFoodText` | khớp tên với kho |
| `services/food-category.ts` `foodCategoryOf`, `FOOD_CATEGORIES` | nhóm thực phẩm (8 nhóm) |
| `dietary.service.ts` `expandRestrictedTerms`, `overlapsFoodTerms` | cảnh báo dị ứng/không thích theo hồ sơ |
| `utils/food-units.ts` `convertQuantity`, `canConvertUnit` | đổi g↔kg, ml↔l khi cộng vào kho |
| `PantryTransactionSource.RECEIPT_SCAN`, `PantryItem.expiryEstimated` | đã có trong schema, chưa dùng |
| `shopping-purchase.service.ts` (ghi có điều kiện, `reversalOfId`, `reversedAt`) | mẫu cho lưu lô và hoàn tác |
| `image-file.ts` `detectImageFormat`, `image-sanitize.ts` (sharp) | kiểm byte đầu, xóa EXIF |
| `ai.service.ts` `getAIStatus`/`isAIConfigured` | biết có chế độ OpenAI hay không |

Lưu ý: `singleImageUpload` đòi Cloudinary → quét hóa đơn cần middleware riêng (không phụ thuộc Cloudinary).

## 1. Lớp nhà cung cấp OCR

```ts
// backend/src/services/receipt/ocr-provider.ts
type ReceiptProviderId = "tesseract" | "openai" | "mock";
type OcrOutput =
  | { kind: "text"; lines: Array<{ text: string; confidence: number }> }          // Tesseract, Mock
  | { kind: "items"; items: RawReceiptItem[]; rawLines: string[] };              // OpenAI (structured output)
interface ReceiptOcrProvider { id: ReceiptProviderId; isAvailable(): boolean; read(image: Buffer): Promise<OcrOutput> }
```

- **TesseractProvider** (phần 1): `tesseract.js` (WASM, chạy được trên `node:22-alpine`), ngôn ngữ `vie+eng`, một worker
  dùng chung, xử lý tuần tự (hàng đợi, tối đa ~3 yêu cầu chờ, quá thì 503 "Đang bận"), timeout 30 s. Tiền xử lý bằng
  sharp: xoay theo EXIF, xám, `normalize`, đổi cạnh dài ~2000 px. Dữ liệu ngôn ngữ `vie` + `eng` **đóng gói sẵn** (gói npm `@tesseract.js-data/vie`, `@tesseract.js-data/eng`, `langPath` cục bộ, không tải từ mạng; quyết định 09/11).
- **OpenAIVisionProvider** (phần 2): Responses API, ảnh base64 `detail: "high"`, structured output bằng Zod
  (`zodTextFormat`), `OPENAI_MODEL` sẵn có. Lỗi/timeout → báo lỗi và cho chọn đọc lại bằng Tesseract.
- **MockProvider**: trả văn bản/items cố định cho test và dev (`RECEIPT_OCR_PROVIDER=mock` chỉ khi `NODE_ENV=test`).
- Chọn chế độ: có key → mặc định OpenAI, không có → Tesseract; người dùng có thể đổi trong hộp quét.
  `GET /api/pantry/receipt-scans/status` trả `{ providers: [...], defaultProvider, remainingToday }`.

## 2. Bộ phân tích dòng (thuần, dùng chung)

`services/receipt/receipt-parser.ts` — đầu vào là các dòng văn bản (Tesseract) hoặc `rawLines` (OpenAI):
- Ghép dòng bị ngắt (tên một dòng, "SL x đơn giá = thành tiền" dòng dưới); nhận các mẫu
  `2 x 15.000`, `0,512 kg`, `1.25KG`, `SL: 3`, giá `15.000`/`15,000`/`15000đ`.
- Tách tên, số lượng, đơn vị (`kg/g/gr/l/ml/lít/cái/quả/trái/bó/gói/hộp/chai/lon/vỉ` → `FoodUnit`; `hộp/chai/lon/vỉ/gói` →
  `PACKAGE`, `quả/trái/cái/bó` → `ITEM`), giá (chỉ để kiểm tra, **không lưu** — `PantryItem` không có cột giá).
  Trong tên có quy cách khối lượng/thể tích × số hộp ("Sữa tươi 180ml" × 4) → tổng lượng 720 ml, tên bỏ quy cách (khớp kho và
  công thức theo ml; đổi khi làm P1-1).
- Bỏ dòng (kèm lý do, vẫn hiện ở màn duyệt để khôi phục): tổng tiền, tạm tính, VAT/thuế, giảm giá/khuyến mãi, tiền
  khách đưa/thối, thẻ/QR, túi nilon, phí/phí giao, điểm tích lũy, đầu/cuối hóa đơn (tên cửa hàng, địa chỉ, MST, SĐT, giờ).
- Nhãn sản phẩm: bắt `HSD|EXP|Hạn sử dụng|Best before` + ngày (dd/mm/yy, dd.mm.yyyy) → `expiryDate` đọc được.
- Kết quả: `RawReceiptItem { rawText, name, quantity, unit, price?, expiryDate?, confidence }` và `skipped[]`.

## 3. Chuẩn hóa (thuần)

`services/receipt/receipt-normalize.ts`:
- **Tên:** hóa đơn siêu thị thường in không dấu/viết tắt ("THIT HEO XAY", "RAU MUONG VSATTP"). Khớp theo tên đã bỏ dấu
  với danh sách tên chuẩn = tên trong kho người dùng + tên nguyên liệu của 33 món + bảng viết tắt nhỏ
  (`receipt-aliases.ts`, dữ liệu) → trả tên có dấu; không khớp thì giữ tên đọc được, cờ `unmatched`.
- Nhóm: `foodCategoryOf`; hạn: đọc được thì dùng (`expiryEstimated=false`), không thì `suggestedPantryDefaults`.
- Đích trong kho: `choosePurchaseTarget` (cộng vào/dùng lại/tạo mới) + quy đổi đơn vị; hiển thị ở màn duyệt.
- Cảnh báo: tên trùng dị ứng (`expandRestrictedTerms(profile.allergies)`) hoặc không thích → chỉ gắn nhãn, không chặn.
- Áp dụng cho cả hai provider (OpenAI cũng đi qua bộ lọc bỏ dòng + chuẩn hóa này).

## 4. Luồng API và màn hình duyệt

Module mới `backend/src/modules/receipt-scan/` (route → controller → service → Prisma, Zod), mount `/api/pantry/receipt-scans`:

| Endpoint | Việc |
|---|---|
| `GET /status` | chế độ có sẵn, số lần còn lại hôm nay |
| `POST /` (multipart `image`, `provider?`) | kiểm ảnh, tạo `ReceiptScan` (PROCESSING), chạy nền OCR → parse → chuẩn hóa; trả ngay 202 `{ id, phase }`. **Không ghi kho** |
| `GET /:id` | trạng thái để hiện tiến trình: `phase` = `queued`/`reading` (kèm `progress` 0–1 của Tesseract)/`parsing`/`ready`/`failed`; `ready` kèm dòng nháp |
| `POST /:id/commit` (các dòng đã sửa) | một transaction: tạo/cộng `PantryItem`, ghi `PantryTransaction` `RECEIPT_SCAN` gắn `receiptScanId`; chỉ commit một lần (`updateMany ... committedAt: null`) |
| `POST /:id/undo` | hoàn cả lô: đánh `reversedAt` có điều kiện, trừ lại từng dòng (không dưới 0, báo phần không trừ được), dòng đảo ghi `reversalOfId` — như "Đã mua" |

- Mọi truy vấn lọc theo `userId` từ JWT; lô của người khác → 404. Commit kiểm lại dữ liệu (Zod: tên ≤ 100, số lượng > 0,
  đơn vị `FoodUnit`, nhóm thuộc 8 nhóm, tối đa 60 dòng), không tin dòng nháp từ client.
- **Migration mới** (thêm, không sửa cũ): model `ReceiptScan { id, userId, provider, status (DRAFT|COMMITTED|REVERSED|FAILED),
  lineCount, durationMs, committedAt?, reversedAt?, createdAt }` + `PantryTransaction.receiptScanId?` (SetNull, index).
  Không lưu ảnh, không lưu văn bản OCR; dòng nháp chỉ giữ trong bộ nhớ server tối đa 30 phút (khởi động lại server thì lần quét đang chờ thành FAILED). Dùng luôn bảng này để đếm số lần quét/ngày.
- **Tiến trình** (quyết định 09/11): màn quét hiện "Đang tải ảnh" (tiến độ upload) → "Đang đọc" (thanh `progress`) → "Đang phân tích", hỏi `GET /:id` mỗi ~1 s.
- Frontend: nút "Quét hóa đơn" ở `PantryHero`; `components/pantry/ReceiptScanDialog.tsx` (chọn/chụp ảnh, thu nhỏ ở trình
  duyệt ≤ 2000 px), `ReceiptReviewList.tsx` + `ReceiptReviewRow.tsx` (bỏ chọn, sửa tên, số lượng, đơn vị, nhóm, hạn bằng
  `DateInput` có nhãn "Hạn ước tính", dòng đích "Cộng vào: Trứng gà (còn 4 quả)"/"Tạo mới", nhãn dị ứng, chữ gốc nhỏ,
  dòng độ tin cậy thấp được tô); mục thu gọn "Dòng đã bỏ qua" có nút khôi phục. Đầu màn hình ghi **"Chế độ đọc: Tesseract
  (đọc trên máy chủ, có thể sai nhiều hơn)"** hoặc "OpenAI". Lưu xong: Toast kèm "Hoàn tác"; lịch sử kho hiện nguồn
  "Quét hóa đơn" và nút hoàn tác lô. Logic thuần ở `features/pantry/receipt-scan.logic.ts` (+ test), API ở
  `features/pantry/receipt-scan.api.ts`, CSS ở `styles/ui/pantry.css` (chỉ token).

## 5. Ảnh và giới hạn

- Middleware `receiptImageUpload` (multer bộ nhớ, ≤ 5 MB, 1 file, kiểm byte đầu jpg/png/webp, không cần Cloudinary).
- sharp: `limitInputPixels`, xoay, xóa EXIF, thu nhỏ cạnh dài 2000 px trước khi OCR/gửi OpenAI; buffer bỏ sau khi đọc,
  **không ghi đĩa, không lưu lâu dài**.
- Giới hạn: `RECEIPT_SCAN_DAILY_LIMIT` lần quét/người/ngày (biến môi trường, mặc định 10; theo giờ Việt Nam, đếm `ReceiptScan`
  kể cả lần lỗi) → 429 kèm thông báo. Admin không miễn.
- Không có key: chế độ OpenAI bị khóa kèm giải thích; Tesseract vẫn dùng được.

## 6. Đánh giá

- `docs/test-evidence/receipts/`: `rNN.jpg` + `rNN.json` (đáp án) + `README.md` (cách chụp, che số thẻ/SĐT/mã thành viên/tên thu ngân). Người dùng tự chụp ~10 hóa đơn thật và commit ảnh đã che.
- Mẫu đáp án: `docs/test-evidence/receipts/_mau-dap-an.json`:

```json
{
  "id": "r01", "kind": "receipt", "store": "Siêu thị (đã che tên)", "note": "chụp nghiêng, giấy nhiệt",
  "items": [
    { "name": "Thịt heo xay", "quantity": 0.5, "unit": "KG", "price": 65000 },
    { "name": "Trứng gà", "quantity": 10, "unit": "ITEM", "price": 32000 },
    { "name": "Sữa tươi 180ml", "quantity": 4, "unit": "PACKAGE", "price": 34000, "expiryDate": null }
  ],
  "ignored": ["Tổng cộng", "VAT", "Túi nilon"]
}
```

- Script `backend/scripts/eval-receipt-ocr.ts` (`npm run eval:receipt -w backend -- --provider tesseract|openai|mock`):
  ghép dòng dự đoán ↔ đáp án theo tên đã bỏ dấu (tham lam, ngưỡng tương đồng), tính **dòng** (precision/recall/F1),
  **tên** đúng, **số lượng** đúng (±1 %), **đơn vị** đúng, dòng rác lọt vào; từng ảnh và tổng; với OpenAI ghi thêm token
  và chi phí. Ghi `docs/test-evidence/receipts/ket-qua-<provider>.md`. Thêm chế độ `--parser-only` đọc `rNN.txt`
  (văn bản gõ lại) để tách lỗi bộ phân tích khỏi lỗi OCR.

## 7. Chia lượt và chi phí

| Lượt | Nội dung | Kiểm tra |
|---|---|---|
| P1-1 (backend) — **xong 09/11** | migration `ReceiptScan`; provider interface + Mock + Tesseract; parser, normalize, aliases; 4 endpoint, quota, ownership, commit một lần, hoàn tác; script eval + file mẫu | test thuần (parser ~30 ca), test API (ownership, 429, commit 2 lần, undo sau khi đã dùng bớt) |
| P1-2 (frontend) | nút, hộp quét, màn duyệt, lịch sử/hoàn tác, logic + test; chạy eval Tesseract trên bộ ảnh | test frontend, build; không Playwright |
| P2 (cần key) | OpenAIVisionProvider (Responses API + Zod), prompt, chọn chế độ, đọc lại bằng Tesseract khi lỗi; eval OpenAI cùng bộ ảnh, so bảng | test với MockProvider/mock OpenAI; eval thật |

**Ước lượng chi phí OpenAI mỗi lần quét** (`gpt-5-mini`, ảnh thu nhỏ 2000 px, `detail: high`): vào ~1.000–1.500 token ảnh +
~800 token lời nhắc; ra ~500–800 token JSON + token suy luận (để `reasoning.effort` thấp). Theo bảng giá `gpt-5-mini`
(0,25 USD/1 triệu token vào, 2 USD/1 triệu token ra) ≈ **0,002–0,005 USD/lần (~50–130 đ)**; 10 lần/ngày × 100 người
< 5 USD/ngày. Phải kiểm lại bảng giá và đo token thật ở P2 (script eval ghi `usage`).

**Rủi ro:** Tesseract đọc giấy nhiệt, ảnh nghiêng, chữ không dấu kém — dự kiến đúng dòng thấp (có thể 40–70 %); đó là
lý do màn duyệt bắt buộc và là số liệu so sánh với OpenAI trong quyển. Tesseract tốn CPU (~2–8 s/ảnh, ~150 MB RAM/worker).
