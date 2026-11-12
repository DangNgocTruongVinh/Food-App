import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { scheduleExpiryEmails } from "./modules/notifications/expiry-email.scheduler.js";

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
