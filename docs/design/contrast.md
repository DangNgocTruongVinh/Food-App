# Bảng đo tương phản token màu

Đo theo WCAG 2.x từ `frontend/src/styles/ui/tokens.css` (cùng công thức với test `frontend/src/features/ui/contrast.test.ts`; test chạy trong `npm test`, đổi token mà cặp nào dưới ngưỡng thì test báo lỗi). Cập nhật 31/10/2026, lượt UI-1.

Ngưỡng: chữ thường 4.5:1; chữ lớn (≥ 24px, hoặc đậm ≥ 19px) và thành phần phi văn bản (viền focus) 3:1.

| Chữ / thành phần | Nền | Ngưỡng | Sáng | Tối | Dùng cho |
|---|---|---|---|---|---|
| `--ink` | `--bg` | 4.5:1 | 13.47 | 15.69 | Chữ chính trên nền trang |
| `--ink` | `--surface` | 4.5:1 | 14.07 | 14.35 | Chữ chính trên card |
| `--ink` | `--surface-2` | 4.5:1 | 12.45 | 12.75 | Chữ chính trên nền phụ |
| `--ink-2` | `--bg` | 4.5:1 | 8.37 | 11.63 | Đoạn văn phụ trên nền trang |
| `--ink-2` | `--surface` | 4.5:1 | 8.74 | 10.64 | Đoạn văn phụ trên card |
| `--muted` | `--bg` | 4.5:1 | 5.22 | 8.18 | Nhãn, chú thích trên nền trang |
| `--muted` | `--surface` | 4.5:1 | 5.45 | 7.48 | Nhãn, chú thích trên card |
| `--muted` | `--surface-2` | 4.5:1 | 4.82 | 6.64 | Nhãn trên nền phụ (skeleton, footer) |
| `--on-action` | `--action` | 4.5:1 | 10.38 | 5.70 | Chữ nút chính, chip đang chọn |
| `--on-action` | `--action-hover` | 4.5:1 | 12.59 | 4.56 | Chữ nút chính khi hover |
| `--action-text` | `--bg` | 4.5:1 | 9.93 | 9.01 | Liên kết, chữ nút phụ trên nền trang |
| `--action-text` | `--surface` | 4.5:1 | 10.38 | 8.24 | Liên kết, mục menu đang chọn trên card |
| `--action-text` | `--surface-2` | 4.5:1 | 9.18 | 7.32 | Liên kết trên nền phụ |
| `--accent` | `--bg` | 3:1 | 5.46 | 9.75 | Cụm nghiêng ở H1 (chữ lớn) |
| `--warn` | `--warn-bg` | 4.5:1 | 5.66 | 7.26 | Chữ cảnh báo trên nền cảnh báo |
| `--warn` | `--surface` | 4.5:1 | 6.49 | 7.83 | Chữ lỗi dưới ô nhập, nút nguy hiểm |
| `--ink` | `--warn-bg` | 4.5:1 | 12.28 | 13.31 | Chữ thường trong khối cảnh báo |
| `--ink` | `--tag-bg` | 4.5:1 | 12.13 | 10.75 | Chữ nhãn (tag) |
| `--action-text` | `--surface` | 3:1 | 10.38 | 8.24 | Viền ô nhập đang focus, outline focus trên card (phi văn bản) |
| `--action-text` | `--bg` | 3:1 | 9.93 | 9.01 | Outline focus bàn phím trên nền trang (phi văn bản) |
| `--warn` | `--bg` | 4.5:1 | 6.21 | 8.56 | Chữ cảnh báo trên nền trang |

## Điều chỉnh so với bảng màu DESIGN.md bản đầu (đã duyệt 31/10/2026, DESIGN.md mục 4 đã cập nhật)

Hai giá trị chế độ tối trong bảng mục 4 không đạt chính quy tắc "mọi cặp chữ/nền ≥ 4.5:1" của mục 4, nên đã chỉnh tối thiểu:

| Token | DESIGN.md | Đang dùng | Lý do |
|---|---|---|---|
| `--action-hover` (tối) | #3A8570 | #3A8270 | Chữ trắng trên #3A8570 chỉ đạt 4.40:1; #3A8270 đạt 4.56:1, gần như cùng màu |
| `--action-text` (mới) | (không có) | sáng #15483C (= `--action`), tối #8FC2AE | `--action` tối #2F725D làm **chữ/viền** trên nền tối chỉ đạt 2.90:1 (card) và 3.16:1 (nền trang). `--action` vẫn dùng làm nền (nút chính, chip đang chọn); chữ liên kết, mục menu đang chọn, chữ nút phụ, viền ô nhập đang focus và outline focus dùng `--action-text` |

Token thêm (không phải màu mới, chỉ để không viết mã màu trong CSS thành phần): `--on-action` (chữ trắng trên nền action), `--shadow-overlay` (bóng của overlay theo mục 7, hai chế độ), `--backdrop` (nền mờ sau hộp thoại).
