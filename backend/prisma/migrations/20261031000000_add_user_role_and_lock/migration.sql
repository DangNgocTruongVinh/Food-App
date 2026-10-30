-- Quyền người dùng (USER/ADMIN) và trạng thái khóa tài khoản.
-- Tài khoản cũ nhận quyền USER và chưa bị khóa.
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER',
ADD COLUMN "lockedAt" TIMESTAMP(3);
