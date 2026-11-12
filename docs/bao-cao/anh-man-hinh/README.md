# Ảnh màn hình cho quyển báo cáo

Chụp ngày 12/11/2026 bằng `npm run e2e:acceptance -- screenshots docs/bao-cao/anh-man-hinh` (script `e2e/acceptance/screenshots.cjs`),
ngay sau `demo:reset`: tài khoản demo (dữ liệu mẫu) và Admin, chế độ sáng, ảnh chụp cả trang. Máy tính 1440px, điện thoại 390px (độ phân giải ×2).
Chạy lại lệnh trên để cập nhật toàn bộ ảnh khi giao diện đổi.

| Tệp | Màn hình | Đường dẫn | Rộng |
|---|---|---|---|
| [01-trang-chu.png](01-trang-chu.png) | Trang chủ (khách) | `/` | 1440px |
| [02-dang-nhap.png](02-dang-nhap.png) | Đăng nhập | `/login` | 1440px |
| [03-dang-ky.png](03-dang-ky.png) | Đăng ký | `/login?mode=register` | 1440px |
| [04-quen-mat-khau.png](04-quen-mat-khau.png) | Quên mật khẩu | `/forgot-password` | 1440px |
| [10-tong-quan.png](10-tong-quan.png) | Tổng quan | `/dashboard` | 1440px |
| [11-kho.png](11-kho.png) | Kho thực phẩm | `/pantry` | 1440px |
| [12-kho-lich-su.png](12-kho-lich-su.png) | Kho: lịch sử thay đổi | `/pantry` | 1440px |
| [13-quet-hoa-don.png](13-quet-hoa-don.png) | Quét hóa đơn (chọn ảnh, chế độ đọc) | `/pantry?scan=1` | 1440px |
| [14-thuc-don.png](14-thuc-don.png) | Thực đơn (thực đơn mẫu đã ăn) | `/meal-plans` | 1440px |
| [15-cong-thuc.png](15-cong-thuc.png) | Công thức (Dành cho bạn, tất cả công thức) | `/recipes` | 1440px |
| [16-tim-kiem.png](16-tim-kiem.png) | Tìm kiếm công thức không dấu ("com tron") | `/recipes` | 1440px |
| [17-chi-tiet-mon.png](17-chi-tiet-mon.png) | Chi tiết công thức | `/recipes/cmvtmoifp00chmx4n0jlh9iif` | 1440px |
| [18-mon-yeu-thich.png](18-mon-yeu-thich.png) | Món yêu thích | `/recipes/favorites` | 1440px |
| [19-cong-dong.png](19-cong-dong.png) | Cộng đồng | `/community` | 1440px |
| [20-tro-ly-ai.png](20-tro-ly-ai.png) | Trợ lý AI (Hỏi Nouri) | `/assistant` | 1440px |
| [21-bao-cao.png](21-bao-cao.png) | Báo cáo (lãng phí, dinh dưỡng tuần) | `/reports` | 1440px |
| [22-ho-so.png](22-ho-so.png) | Hồ sơ dinh dưỡng | `/profile` | 1440px |
| [23-trang-chu-da-dang-nhap.png](23-trang-chu-da-dang-nhap.png) | Trang chủ khi đã đăng nhập (Xin chào, Đăng xuất) | `/` | 1440px |
| [30-dien-thoai-trang-chu.png](30-dien-thoai-trang-chu.png) | Điện thoại: Trang chủ (khách) | `/` | 390px |
| [31-dien-thoai-tong-quan.png](31-dien-thoai-tong-quan.png) | Điện thoại: Tổng quan | `/dashboard` | 390px |
| [32-dien-thoai-kho.png](32-dien-thoai-kho.png) | Điện thoại: Kho | `/pantry` | 390px |
| [33-dien-thoai-thuc-don.png](33-dien-thoai-thuc-don.png) | Điện thoại: Thực đơn | `/meal-plans` | 390px |
| [34-dien-thoai-cong-thuc.png](34-dien-thoai-cong-thuc.png) | Điện thoại: Công thức | `/recipes` | 390px |
| [40-admin-tong-quan.png](40-admin-tong-quan.png) | Admin: Tổng quan (thống kê) | `/admin` | 1440px |
| [41-admin-cong-thuc.png](41-admin-cong-thuc.png) | Admin: Công thức | `/admin/recipes` | 1440px |
| [42-admin-sua-mon.png](42-admin-sua-mon.png) | Admin: Sửa công thức | `/admin/recipes/cmvtmoiab001umx4nrr0uzl9n/edit` | 1440px |
| [43-admin-nguoi-dung.png](43-admin-nguoi-dung.png) | Admin: Người dùng | `/admin/users` | 1440px |
| [44-admin-kiem-duyet.png](44-admin-kiem-duyet.png) | Admin: Kiểm duyệt cộng đồng | `/admin/moderation` | 1440px |
| [45-admin-nhat-ky.png](45-admin-nhat-ky.png) | Admin: Nhật ký thao tác | `/admin/audit-logs` | 1440px |
