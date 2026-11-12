# Bộ hóa đơn đánh giá quét hóa đơn (GĐ3c)

Khoảng 10 hóa đơn/nhãn thật để đo tỉ lệ đọc đúng của từng chế độ (Tesseract và OpenAI).

## Tệp trong thư mục

| Tệp | Nội dung |
|---|---|
| `rNN.jpg` (hoặc `.png`, `.webp`) | Ảnh đã che thông tin cá nhân (`r01`, `r02`, …) |
| `rNN.json` | Đáp án: các dòng hàng thật trên hóa đơn, theo mẫu `_mau-dap-an.json` |
| `rNN.txt` (tùy chọn) | Chữ trên hóa đơn gõ lại từng dòng, để đo riêng bộ phân tích (`--parser-only`), mẫu `_mau-dap-an.txt` |
| `ket-qua.md` | Kết quả do script ghi ra (mọi chế độ đã chạy: tỉ lệ đúng, thời gian, token và chi phí OpenAI) |

Tệp bắt đầu bằng `_` là mẫu, script bỏ qua.

## Cách chụp

- Chụp thẳng từ trên xuống, hóa đơn phẳng (vuốt cho hết cong), cả tờ nằm trong khung, nền tối, đủ sáng, không lóa đèn flash.
- Mỗi ảnh một hóa đơn. Hóa đơn dài thì chụp làm hai ảnh (`r05a`, `r05b`), mỗi ảnh một tệp đáp án riêng.
- Nên có nhiều loại: siêu thị in không dấu, cửa hàng tiện lợi, chợ/tạp hóa viết tay (nếu có), 1–2 nhãn sản phẩm có HSD, 1 ảnh chụp nghiêng hoặc thiếu sáng.
- Ảnh tối đa 5 MB (giới hạn của ứng dụng); ảnh điện thoại lớn hơn thì giảm độ phân giải khi xuất.

## Che thông tin

Ảnh (`*.jpg`, `*.jpeg`, `*.png`, `*.webp`) nằm trong `.gitignore`, chỉ để trên máy; chỉ commit đáp án `.json`, `.txt` và
`ket-qua.md`. Nếu cần đưa ảnh vào quyển/repo, bắt buộc che (tô đen kín, không làm mờ) trước:

- số thẻ ngân hàng (kể cả 4 số cuối), mã giao dịch thẻ/QR;
- số điện thoại, mã thành viên/mã khách hàng, tên khách hàng, điểm tích lũy;
- tên thu ngân/nhân viên.

Không cần che: tên mặt hàng, số lượng, đơn giá, thành tiền, tổng tiền (đó là dữ liệu cần đọc). Ảnh xuất lại sau khi che
thường không còn EXIF; nếu còn GPS thì xóa trước khi commit.

## Viết đáp án

- `items`: mọi dòng hàng thực phẩm, đúng thứ tự trên hóa đơn. `name` viết có dấu, tên thường gọi (không mã hàng, không thương hiệu
  nếu không cần). `unit` là một trong `G`, `KG`, `ML`, `L`, `ITEM` (cái/quả/bó/con), `PACKAGE` (gói/hộp/chai/vỉ).
- Hàng có quy cách × số hộp (vd. 4 hộp sữa 180 ml) ghi tổng lượng: `720` `ML`.
- `price`: thành tiền của dòng (đồng), không bắt buộc. `expiryDate`: `yyyy-MM-dd` nếu in trên nhãn, không có thì bỏ.
- `ignored`: các dòng không phải hàng (túi, tổng tiền, VAT…), chỉ để tham khảo.

## Chạy đánh giá

```bash
npm run eval:receipt -w backend                    # Tesseract trên các ảnh rNN.*
npm run eval:receipt -w backend -- --parser-only   # chỉ bộ phân tích, đọc rNN.txt
```

Script không cần database (tên thực phẩm lấy từ bộ 33 món, kho rỗng) và in bảng: dòng đáp án, dòng đọc được, ghép được, tên/đơn vị/số
lượng đúng, thời gian; tổng precision/recall/F1. Cách chấm: `backend/src/services/receipt/receipt-eval.ts`.
