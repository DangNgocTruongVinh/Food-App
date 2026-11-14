import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { ensureCatalog } from "./services/catalog/catalog.service.js";
import { scheduleExpiryEmails } from "./modules/notifications/expiry-email.scheduler.js";

// Danh mục (dị ứng, nhóm thực phẩm, hóa đơn) phải có trong bộ nhớ trước khi nhận request lọc/gợi ý.
await ensureCatalog();

const server = app.listen(env.PORT, () => {
  console.log(`NOURI API đang chạy tại http://localhost:${env.PORT}`);
});
const expiryEmailJob = scheduleExpiryEmails();

async function shutdown() {
  await expiryEmailJob.stop();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
