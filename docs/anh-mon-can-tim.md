# Ảnh món cần tìm

Sinh từ `backend/prisma/seed-data.ts` bằng `npm run upload:recipe-photos -w backend -- --list` (33 món).
Đặt ảnh tên `<slug>.jpg` (hoặc .png, .webp, ≤ 5 MB) vào một thư mục, kèm `nguon.txt` mỗi dòng `slug|nguồn ảnh` (đường dẫn, tác giả,
giấy phép), rồi chạy `npm run upload:recipe-photos -w backend -- --dir <thư mục> --dry-run` để kiểm, bỏ `--dry-run` để tải thật.
Chạy trên máy (thư mục ảnh ở máy): đặt `DATABASE_URL` tới Postgres của Docker (`localhost:5432`), `JWT_SECRET`, `CLOUDINARY_*` như
`backend/.env.example`. Ảnh được xóa EXIF và tải bằng đúng luồng "Thay ảnh" của Admin (ghi nhật ký Admin, xóa ảnh cũ sau khi lưu).

| # | Slug (tên file) | Tên món |
|---|---|---|
| 1 | `pho-bo` | Phở bò |
| 2 | `chao-ga-hanh-gung` | Cháo gà hành gừng |
| 3 | `banh-mi-op-la` | Bánh mì ốp la |
| 4 | `xoi-dau-xanh` | Xôi đậu xanh muối mè |
| 5 | `banh-mi-dau-hu-sa` | Bánh mì đậu hũ sả |
| 6 | `trung-chien-rau-cu` | Trứng chiên rau củ |
| 7 | `yen-mach-qua-dem` | Yến mạch qua đêm sữa chua chuối |
| 8 | `sua-dau-nanh` | Sữa đậu nành |
| 9 | `bun-xao-chay` | Bún xào chay |
| 10 | `com-tam-suon-nuong` | Cơm tấm sườn nướng |
| 11 | `thit-kho-trung` | Thịt kho trứng (kèm cơm) |
| 12 | `ca-kho-to` | Cá kho tộ (kèm cơm) |
| 13 | `canh-chua-ca-loc` | Canh chua cá lóc (kèm cơm) |
| 14 | `ga-xao-sa-ot` | Gà xào sả ớt (kèm cơm) |
| 15 | `canh-bi-do-tom` | Canh bí đỏ nấu tôm (kèm cơm) |
| 16 | `bun-cha-ha-noi` | Bún chả Hà Nội |
| 17 | `bun-bo-nam-bo` | Bún bò Nam Bộ |
| 18 | `bo-xao-bong-cai` | Bò xào bông cải |
| 19 | `ca-hap-gung-hanh` | Cá hấp gừng hành, rau luộc |
| 20 | `dau-hu-sot-ca-chua` | Đậu hũ sốt cà chua (kèm cơm) |
| 21 | `canh-chua-chay` | Canh chua chay (kèm cơm) |
| 22 | `nam-kho-tieu` | Nấm kho tiêu (kèm cơm) |
| 23 | `com-chien-chay` | Cơm chiên chay rau củ nấm |
| 24 | `mi-y-sot-bo-bam` | Mì Ý sốt bò bằm |
| 25 | `ga-teriyaki` | Gà teriyaki (kèm cơm) |
| 26 | `com-tron-han-quoc` | Cơm trộn Hàn Quốc (bibimbap) |
| 27 | `pad-thai-tom` | Pad Thái tôm |
| 28 | `salad-hy-lap` | Salad Hy Lạp phô mai feta |
| 29 | `goi-cuon-tom-thit` | Gỏi cuốn tôm thịt |
| 30 | `che-dau-den` | Chè đậu đen |
| 31 | `sua-chua-nep-cam` | Sữa chua nếp cẩm |
| 32 | `sinh-to-bo` | Sinh tố bơ |
| 33 | `khoai-lang-luoc` | Khoai lang luộc |
