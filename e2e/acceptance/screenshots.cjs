// Ảnh màn hình cho quyển báo cáo: mọi trang chính ở 1440px chế độ sáng (và vài trang ở 390px), tài khoản demo + Admin thật.
// Chạy NGAY SAU demo:reset để dữ liệu giống buổi demo. Chỉ đọc (không tạo/sửa dữ liệu), không in mật khẩu.
// npm run e2e:acceptance -- screenshots docs/bao-cao/anh-man-hinh  → ghi ảnh + README.md (danh sách ảnh) vào thư mục đó.
const ACC = require("./lib/env.cjs");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { toWebp } = require("./lib/to-webp.cjs");
const [OUT] = process.argv.slice(2);
const APP = process.env.APP_URL || "http://localhost:8080";

const shots = [];

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // Chờ hết khung "đang tải" (skeleton) và ảnh đã tải xong.
  await page.waitForFunction(() => !document.querySelector("[aria-busy='true'], .ui-skeleton"), null, { timeout: 15_000 }).catch(() => undefined);
  // Ảnh tải lười (loading="lazy") ngoài màn hình có thể không bao giờ tải: cuộn hết trang để kích hoạt, chờ tối đa 8 giây.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
    const pending = [...document.images].filter((img) => !img.complete).map((img) => new Promise((done) => { img.onload = img.onerror = done; }));
    await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 8000))]);
  });
  await page.waitForTimeout(400);
}

async function shoot(page, file, title, url, prepare) {
  if (url) await page.goto(APP + url);
  await settle(page);
  if (prepare) { await prepare(page); await settle(page); }
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  // Lưu WebP chất lượng 90 (giữ số điểm ảnh); ảnh cao quá 16.383 px được cắt thành nhiều phần.
  const files = await toWebp(path.join(OUT, file));
  shots.push({ files, title, url: url ?? "", width: page.viewportSize().width });
  console.log("Đã chụp", file);
}

async function login(page, account) {
  await page.goto(APP + "/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(/\/(dashboard|admin)/);
}

(async () => {
  if (!OUT) throw new Error("Thiếu thư mục ảnh.");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = (width) => browser.newContext({
    viewport: { width, height: width > 600 ? 900 : 844 }, deviceScaleFactor: width > 600 ? 1 : 2, reducedMotion: "reduce",
  });

  // Khách (chưa đăng nhập).
  const guest = await (await context(1440)).newPage();
  await shoot(guest, "01-trang-chu.png", "Trang chủ (khách)", "/");
  await shoot(guest, "02-dang-nhap.png", "Đăng nhập", "/login");
  await shoot(guest, "03-dang-ky.png", "Đăng ký", "/login?mode=register");
  await shoot(guest, "04-quen-mat-khau.png", "Quên mật khẩu", "/forgot-password");

  // Người dùng demo, 1440px.
  const page = await (await context(1440)).newPage();
  await login(page, ACC.demo());
  await shoot(page, "10-tong-quan.png", "Tổng quan", "/dashboard");
  await shoot(page, "11-kho.png", "Kho thực phẩm", "/pantry");
  await shoot(page, "12-kho-lich-su.png", "Kho: lịch sử thay đổi", "/pantry", async (p) => {
    const tab = p.getByRole("tab", { name: /Lịch sử/ }).or(p.getByRole("button", { name: /Lịch sử/ })).first();
    if (await tab.count()) await tab.click();
  });
  await shoot(page, "13-quet-hoa-don.png", "Quét hóa đơn (chọn ảnh, chế độ đọc)", "/pantry?scan=1");
  await shoot(page, "14-thuc-don.png", "Thực đơn (thực đơn mẫu đã ăn)", "/meal-plans");
  await shoot(page, "15-cong-thuc.png", "Công thức (Dành cho bạn, tất cả công thức)", "/recipes");
  await shoot(page, "16-tim-kiem.png", "Tìm kiếm công thức không dấu (\"com tron\")", "/recipes", async (p) => {
    await p.getByRole("searchbox").fill("com tron");
    await p.locator("#recipes-all-title").scrollIntoViewIfNeeded();
  });
  const firstRecipe = await page.locator(".recipes-results__list a[href^='/recipes/']").first().getAttribute("href").catch(() => null);
  await shoot(page, "17-chi-tiet-mon.png", "Chi tiết công thức", firstRecipe ?? "/recipes");
  await shoot(page, "18-mon-yeu-thich.png", "Món yêu thích", "/recipes/favorites");
  await shoot(page, "19-cong-dong.png", "Cộng đồng", "/community");
  await shoot(page, "20-tro-ly-ai.png", "Trợ lý AI (Hỏi Nouri)", "/assistant");
  await shoot(page, "21-bao-cao.png", "Báo cáo (lãng phí, dinh dưỡng tuần)", "/reports");
  await shoot(page, "22-ho-so.png", "Hồ sơ dinh dưỡng", "/profile");
  await shoot(page, "23-trang-chu-da-dang-nhap.png", "Trang chủ khi đã đăng nhập (Xin chào, Đăng xuất)", "/");

  // Điện thoại 390px.
  const phone = await (await context(390)).newPage();
  await shoot(phone, "30-dien-thoai-trang-chu.png", "Điện thoại: Trang chủ (khách)", "/");
  await login(phone, ACC.demo());
  await shoot(phone, "31-dien-thoai-tong-quan.png", "Điện thoại: Tổng quan", "/dashboard");
  await shoot(phone, "32-dien-thoai-kho.png", "Điện thoại: Kho", "/pantry");
  await shoot(phone, "33-dien-thoai-thuc-don.png", "Điện thoại: Thực đơn", "/meal-plans");
  await shoot(phone, "34-dien-thoai-cong-thuc.png", "Điện thoại: Công thức", "/recipes");

  // Admin, 1440px.
  const admin = await (await context(1440)).newPage();
  await login(admin, ACC.admin());
  await shoot(admin, "40-admin-tong-quan.png", "Admin: Tổng quan (thống kê)", "/admin");
  await shoot(admin, "41-admin-cong-thuc.png", "Admin: Công thức", "/admin/recipes");
  const editHref = await admin.locator(".ad-row__link[href]").first().getAttribute("href").catch(() => null);
  await shoot(admin, "42-admin-sua-mon.png", "Admin: Sửa công thức", editHref ?? "/admin/recipes/new");
  await shoot(admin, "43-admin-nguoi-dung.png", "Admin: Người dùng", "/admin/users");
  await shoot(admin, "44-admin-kiem-duyet.png", "Admin: Kiểm duyệt cộng đồng", "/admin/moderation");
  await shoot(admin, "45-admin-nhat-ky.png", "Admin: Nhật ký thao tác", "/admin/audit-logs");

  await browser.close();
  const day = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const rows = shots.map((s) => `| ${s.files.map((name) => `[${name}](${name})`).join(", ")} | ${s.title} | \`${s.url || "-"}\` | ${s.width}px |`).join("\n");
  fs.writeFileSync(path.join(OUT, "README.md"), `# Ảnh màn hình cho quyển báo cáo

Chụp ngày ${day} bằng \`npm run e2e:acceptance -- screenshots docs/bao-cao/anh-man-hinh\` (script \`e2e/acceptance/screenshots.cjs\`),
ngay sau \`demo:reset\`: tài khoản demo (dữ liệu mẫu) và Admin, ảnh chụp cả trang. Máy tính 1440px, điện thoại 390px (độ phân giải ×2).
Định dạng WebP chất lượng 90 (đủ in, giữ nguyên số điểm ảnh); ảnh cao quá 16.383 px (giới hạn của WebP) được cắt thành nhiều phần nối tiếp.
Chạy lại lệnh trên để cập nhật toàn bộ ảnh khi giao diện đổi.

| Tệp | Màn hình | Đường dẫn | Rộng |
|---|---|---|---|
${rows}
`);
  console.log(`Xong ${shots.length} ảnh`);
})().catch((error) => { console.error(error.message); process.exit(1); });
