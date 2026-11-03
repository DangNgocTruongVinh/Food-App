import { PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline/promises";
import { confirmReset, DEMO_EMAIL, resetDemoAccount } from "./demo-account.js";

// Đặt lại tài khoản demo (chạy trước buổi demo): `npm run demo:reset -- --yes` (trong container backend) hoặc
// `npm run demo:reset:dev -- --yes` (máy dev). Không có --yes thì hỏi xác nhận; không có terminal để hỏi thì dừng.

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const confirmed = await confirmReset(process.argv.slice(2), Boolean(process.stdin.isTTY), (question) => rl.question(question)).finally(() => rl.close());
  if (!confirmed) {
    console.error("Đã hủy: chưa xác nhận. Chạy lại với --yes để đặt lại dữ liệu demo.");
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient();
  try {
    const result = await resetDemoAccount(prisma);
    // Ảnh bài viết của demo trên Cloudinary: xóa sau khi transaction thành công (lỗi chỉ ghi log). Nạp muộn vì cần biến môi trường.
    if (result.imagePublicIds.length) {
      const { deleteImageQuietly } = await import("../src/services/image-upload.service.js");
      for (const publicId of result.imagePublicIds) await deleteImageQuietly(publicId);
    }
    const removed = Object.entries(result.removed).map(([key, count]) => `${key} ${count}`).join(", ");
    console.log(`Đã đặt lại ${DEMO_EMAIL}. Đã xóa: ${removed}, ảnh ${result.imagePublicIds.length}. Kho mẫu: ${result.pantryItems} thực phẩm.`);
    const samples = result.sampleAccounts;
    console.log(`Tài khoản mẫu minh họa: ${samples.accounts} tài khoản, ${samples.posts} bài viết, ${samples.likes} lượt thích (mật khẩu ngẫu nhiên, không in).`);
    console.log(`Lịch sử mẫu của demo: ${result.demoHistory.meals} bữa đã ăn, ${result.demoHistory.likes} lượt thích (dữ liệu mẫu, khoảng 2 tuần trước).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
