# UI-11 — Tốc độ tải trang Landing (/)

Đo bằng Playwright trên bản build (`vite build` + `vite preview`, cùng backend Docker), khách chưa đăng nhập, bộ nhớ đệm trống, trung vị 5 lần.
Điện thoại: giả lập mạng 1,6 Mb/s, độ trễ 150 ms, CPU chậm 4 lần. Số đo của bản cũ được đo lại ngay trước bản mới, trên cùng máy.

| | Bản cũ (trước UI-11) | Bản mới (UI-11) |
|---|---|---|
| Máy tính: FCP / LCP | 1,30 s / 2,30 s | 0,55 s / 0,55 s |
| Máy tính: số request / dung lượng tải | 41 / 11.627 KB (ảnh 10.411 KB) | 22 / 659 KB (ảnh 0 KB) |
| Điện thoại: FCP / LCP | 6,69 s / 6,96 s | 3,24 s / 3,24 s |
| Điện thoại: dung lượng tải | 597 KB | 612 KB |
| JS gói chính (chưa nén) | 746 KB | 564 KB |
| CSS (chưa nén) | 293 KB | 160 KB |

Ghi chú:
- Điện thoại bản cũ: trong thời gian đo, ảnh trang trí (10 MB) chưa kịp tải ở mạng chậm nên không tính vào dung lượng; bản mới không có ảnh trang trí.
- Bản mới chưa có ảnh món thật (chưa tải ảnh lên Cloudinary): khi có ảnh, hero tải thêm một ảnh bản ≤ 1200px (`f_auto,q_auto`).
- Phông chiếm phần lớn dung lượng còn lại: dòng `@import` Manrope/Outfit cũ ở `styles.css` sẽ gỡ ở UI-12.
