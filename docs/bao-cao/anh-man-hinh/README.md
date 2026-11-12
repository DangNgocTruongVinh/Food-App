# Ảnh màn hình cho quyển báo cáo

Chụp ngày 12/11/2026 bằng `npm run e2e:acceptance -- screenshots docs/bao-cao/anh-man-hinh` (script `e2e/acceptance/screenshots.cjs`),
ngay sau `demo:reset`: tài khoản demo (dữ liệu mẫu) và Admin, ảnh chụp cả trang. Máy tính 1440px, điện thoại 390px (độ phân giải ×2).
Định dạng WebP chất lượng 90 (đủ in, giữ nguyên số điểm ảnh); ảnh cao quá 16.383 px (giới hạn của WebP) được cắt thành nhiều phần nối tiếp.
Dung lượng cả thư mục: 22,6 MB (PNG) → 8,3 MB (WebP).
Chạy lại lệnh trên để cập nhật toàn bộ ảnh khi giao diện đổi.

| Tệp | Màn hình | Đường dẫn | Rộng |
|---|---|---|---|
| [01-trang-chu.webp](01-trang-chu.webp) | Trang chủ (khách) | `/` | 1440px |
| [02-dang-nhap.webp](02-dang-nhap.webp) | Đăng nhập | `/login` | 1440px |
| [03-dang-ky.webp](03-dang-ky.webp) | Đăng ký | `/login?mode=register` | 1440px |
| [04-quen-mat-khau.webp](04-quen-mat-khau.webp) | Quên mật khẩu | `/forgot-password` | 1440px |
| [10-tong-quan.webp](10-tong-quan.webp) | Tổng quan | `/dashboard` | 1440px |
| [11-kho.webp](11-kho.webp) | Kho thực phẩm | `/pantry` | 1440px |
| [12-kho-lich-su.webp](12-kho-lich-su.webp) | Kho: lịch sử thay đổi | `/pantry` | 1440px |
| [13-quet-hoa-don.webp](13-quet-hoa-don.webp) | Quét hóa đơn (chọn ảnh, chế độ đọc) | `/pantry?scan=1` | 1440px |
| [14-thuc-don.webp](14-thuc-don.webp) | Thực đơn (thực đơn mẫu đã ăn) | `/meal-plans` | 1440px |
| [15-cong-thuc.webp](15-cong-thuc.webp) | Công thức (Dành cho bạn, tất cả công thức) | `/recipes` | 1440px |
| [16-tim-kiem.webp](16-tim-kiem.webp) | Tìm kiếm công thức không dấu ("com tron") | `/recipes` | 1440px |
| [17-chi-tiet-mon.webp](17-chi-tiet-mon.webp) | Chi tiết công thức | `/recipes/cmvtmoifp00chmx4n0jlh9iif` | 1440px |
| [18-mon-yeu-thich.webp](18-mon-yeu-thich.webp) | Món yêu thích | `/recipes/favorites` | 1440px |
| [19-cong-dong.webp](19-cong-dong.webp) | Cộng đồng | `/community` | 1440px |
| [20-tro-ly-ai.webp](20-tro-ly-ai.webp) | Trợ lý AI (Hỏi Nouri) | `/assistant` | 1440px |
| [21-bao-cao.webp](21-bao-cao.webp) | Báo cáo (lãng phí, dinh dưỡng tuần) | `/reports` | 1440px |
| [22-ho-so.webp](22-ho-so.webp) | Hồ sơ dinh dưỡng | `/profile` | 1440px |
| [23-trang-chu-da-dang-nhap.webp](23-trang-chu-da-dang-nhap.webp) | Trang chủ khi đã đăng nhập (Xin chào, Đăng xuất) | `/` | 1440px |
| [30-dien-thoai-trang-chu-1.webp](30-dien-thoai-trang-chu-1.webp), [30-dien-thoai-trang-chu-2.webp](30-dien-thoai-trang-chu-2.webp) | Điện thoại: Trang chủ (khách) | `/` | 390px |
| [31-dien-thoai-tong-quan.webp](31-dien-thoai-tong-quan.webp) | Điện thoại: Tổng quan | `/dashboard` | 390px |
| [32-dien-thoai-kho.webp](32-dien-thoai-kho.webp) | Điện thoại: Kho | `/pantry` | 390px |
| [33-dien-thoai-thuc-don.webp](33-dien-thoai-thuc-don.webp) | Điện thoại: Thực đơn | `/meal-plans` | 390px |
| [34-dien-thoai-cong-thuc.webp](34-dien-thoai-cong-thuc.webp) | Điện thoại: Công thức | `/recipes` | 390px |
| [40-admin-tong-quan.webp](40-admin-tong-quan.webp) | Admin: Tổng quan (thống kê) | `/admin` | 1440px |
| [41-admin-cong-thuc.webp](41-admin-cong-thuc.webp) | Admin: Công thức | `/admin/recipes` | 1440px |
| [42-admin-sua-mon.webp](42-admin-sua-mon.webp) | Admin: Sửa công thức | `/admin/recipes/cmvtmoiab001umx4nrr0uzl9n/edit` | 1440px |
| [43-admin-nguoi-dung.webp](43-admin-nguoi-dung.webp) | Admin: Người dùng | `/admin/users` | 1440px |
| [44-admin-kiem-duyet.webp](44-admin-kiem-duyet.webp) | Admin: Kiểm duyệt cộng đồng | `/admin/moderation` | 1440px |
| [45-admin-nhat-ky.webp](45-admin-nhat-ky.webp) | Admin: Nhật ký thao tác | `/admin/audit-logs` | 1440px |
