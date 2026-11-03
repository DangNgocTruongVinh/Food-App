-- Tài khoản mẫu minh họa (GĐ3b-R4): tạo bằng seed để thuật toán gợi ý cộng tác có dữ liệu khi demo.
-- Không tính vào thống kê Admin. Tài khoản cũ là tài khoản thật (false).
ALTER TABLE "User" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;
