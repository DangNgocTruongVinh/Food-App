# Bảng đo tương phản token màu

Đo theo WCAG 2.x từ `frontend/src/styles/ui/tokens.css` (cùng công thức với test `frontend/src/features/ui/contrast.test.ts`; test chạy trong `npm test`, đổi token mà cặp nào dưới ngưỡng thì test báo lỗi). Cập nhật 31/10/2026, lượt UI-2; bỏ chế độ tối 12/11/2026.

Ngưỡng: chữ thường 4.5:1; chữ lớn (≥ 24px, hoặc đậm ≥ 19px) và thành phần phi văn bản (viền focus) 3:1.

| Chữ / thành phần | Nền | Ngưỡng | Tỉ lệ | Dùng cho |
|---|---|---|---|---|
| `--ink` | `--bg` | 4.5:1 | 13.47 | Chữ chính trên nền trang |
| `--ink` | `--surface` | 4.5:1 | 14.07 | Chữ chính trên card |
| `--ink` | `--surface-2` | 4.5:1 | 12.45 | Chữ chính trên nền phụ |
| `--ink-2` | `--bg` | 4.5:1 | 8.37 | Đoạn văn phụ trên nền trang |
| `--ink-2` | `--surface` | 4.5:1 | 8.74 | Đoạn văn phụ trên card |
| `--ink-2` | `--surface-2` | 4.5:1 | 7.74 | Liên kết footer, mục menu chưa chọn trên nền phụ |
| `--muted` | `--bg` | 4.5:1 | 5.22 | Nhãn, chú thích trên nền trang |
| `--muted` | `--surface` | 4.5:1 | 5.45 | Nhãn, chú thích trên card |
| `--muted` | `--surface-2` | 4.5:1 | 4.82 | Nhãn trên nền phụ (skeleton, footer) |
| `--on-action` | `--action` | 4.5:1 | 10.38 | Chữ nút chính, chip đang chọn |
| `--on-action` | `--action-hover` | 4.5:1 | 12.59 | Chữ nút chính khi hover |
| `--action-text` | `--bg` | 4.5:1 | 9.93 | Liên kết, chữ nút phụ trên nền trang |
| `--action-text` | `--surface` | 4.5:1 | 10.38 | Liên kết, mục menu đang chọn trên card |
| `--action-text` | `--surface-2` | 4.5:1 | 9.18 | Liên kết trên nền phụ |
| `--accent` | `--bg` | 3:1 | 5.46 | Cụm nghiêng ở H1 (chữ lớn) |
| `--warn` | `--warn-bg` | 4.5:1 | 5.66 | Chữ cảnh báo trên nền cảnh báo |
| `--warn` | `--surface` | 4.5:1 | 6.49 | Chữ lỗi dưới ô nhập, nút nguy hiểm |
| `--ink` | `--warn-bg` | 4.5:1 | 12.28 | Chữ thường trong khối cảnh báo |
| `--ink` | `--tag-bg` | 4.5:1 | 12.13 | Chữ nhãn (tag) |
| `--action-text` | `--surface` | 3:1 | 10.38 | Viền ô nhập đang focus, outline focus trên card (phi văn bản) |
| `--action-text` | `--bg` | 3:1 | 9.93 | Outline focus bàn phím trên nền trang (phi văn bản) |
| `--warn` | `--bg` | 4.5:1 | 6.21 | Chữ cảnh báo trên nền trang |

## Chỉ giao diện sáng (12/11/2026)

Bỏ chế độ tối (token tối, nút chuyển, lưu lựa chọn); bảng trên là giao diện sáng duy nhất. Lý do và hướng phát triển: `docs/han-che.md`.
`--action-text` (chữ/viền) vẫn là token riêng, ở giao diện sáng cùng giá trị với `--action` (#15483C).
