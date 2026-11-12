// Luồng demo (rà soát cuối): đi lại các luồng chính trên giao diện hiện tại bằng tài khoản demo và Admin thật.
// Đăng nhập → Kho → Quét hóa đơn (chế độ dự phòng, ảnh hóa đơn tạo ngay trong script, không lưu vào kho) → Tạo thực đơn
// → Đánh dấu đã ăn (trừ kho) → Báo cáo → Gợi ý → Tìm kiếm (không dấu) → Admin (thống kê, công thức, bộ lọc Đã xóa).
// Chạy SAU demo:reset (script tạo một thực đơn và trừ kho của demo; chạy demo:reset lại khi xong).
// Cần Docker đang chạy (app 8080, API 4000); DEMO_EMAIL/DEMO_PASSWORD, ADMIN_EMAIL/ADMIN_PASSWORD trong biến môi trường hoặc .env.
// node demo-flow.cjs <thư mục ảnh lỗi> — chỉ chụp ảnh khi một bước LỖI (để xem lại), không in mật khẩu.
const ACC = require("./lib/env.cjs");
const path = require("path");
const { chromium } = require("playwright-core");
const [OUT] = process.argv.slice(2);
const APP = process.env.APP_URL || "http://localhost:8080";

const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); return ok; };

// Ảnh hóa đơn: trang HTML chữ đen nền trắng, chụp thành PNG (Tesseract đọc được, không cần ảnh thật).
const RECEIPT_HTML = `<body style="margin:0;background:#fff"><div id="r" style="width:560px;padding:32px;font:28px/1.6 'Courier New',monospace;color:#000">
  <div style="text-align:center;font-weight:bold">SIEU THI MAU</div><div>HOA DON BAN HANG</div><hr>
  <div>Ca rot 1kg ........ 25.000</div><div>Trung ga 10 qua .... 32.000</div><div>Sua tuoi 1l ........ 30.000</div>
  <hr><div>TONG CONG ........ 87.000</div></div></body>`;

async function step(page, name, fn) {
  try {
    const detail = await fn();
    return check(name, true, detail || "");
  } catch (error) {
    if (OUT) await page.screenshot({ path: path.join(OUT, `loi-${results.length + 1}.png`) }).catch(() => undefined);
    return check(name, false, error.message.split("\n")[0]);
  }
}

async function login(page, account) {
  await page.goto(APP + "/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", (error) => errors.push(String(error)));

  await step(page, "1. Đăng nhập demo → Tổng quan", async () => {
    await login(page, ACC.demo());
    await page.waitForURL(/\/dashboard/);
    await page.getByRole("heading", { name: "Gợi ý cho bạn" }).waitFor();
  });

  await step(page, "2. Kho thực phẩm có kho mẫu", async () => {
    await page.goto(APP + "/pantry");
    await page.getByText("Đậu hũ").first().waitFor();
  });

  await step(page, "3. Quét hóa đơn chế độ dự phòng → màn kiểm tra (không lưu)", async () => {
    const shot = await browser.newPage({ viewport: { width: 640, height: 520 } });
    await shot.setContent(RECEIPT_HTML);
    const image = await shot.locator("#r").screenshot({ type: "png" });
    await shot.close();
    await page.goto(APP + "/pantry?scan=1");
    const dialog = page.getByRole("dialog", { name: "Quét hóa đơn" });
    await dialog.waitFor();
    const fallback = dialog.getByRole("radio", { name: "Chế độ dự phòng" });
    if (await fallback.count()) await fallback.check();
    await dialog.locator('input[type="file"]:not([capture])').setInputFiles({ name: "hoa-don-mau.png", mimeType: "image/png", buffer: image });
    await page.getByRole("dialog", { name: "Kiểm tra trước khi lưu" }).waitFor({ timeout: 120_000 });
    const save = page.getByRole("button", { name: /^Lưu \d+ thực phẩm vào kho$/ });
    const lines = (await save.count()) ? (await save.textContent()).match(/\d+/)[0] : "0";
    await page.keyboard.press("Escape");
    return `đọc được ${lines} dòng, đóng không lưu`;
  });

  await step(page, "4. Tạo thực đơn (từ hôm nay) và áp dụng", async () => {
    await page.goto(APP + "/meal-plans");
    await page.getByRole("button", { name: "Tạo thực đơn", exact: true }).click();
    await page.getByRole("button", { name: "Áp dụng thực đơn" }).waitFor({ timeout: 180_000 });
    await page.getByRole("button", { name: "Áp dụng thực đơn" }).click();
    await page.getByRole("button", { name: /^Đánh dấu đã ăn: / }).first().waitFor();
  });

  await step(page, "5. Đánh dấu đã ăn một bữa (trừ kho)", async () => {
    await page.getByRole("button", { name: /^Đánh dấu đã ăn: / }).first().click();
    const consume = page.getByRole("button", { name: "Trừ kho và đánh dấu đã ăn" });
    const onlyMark = page.getByRole("button", { name: "Chỉ đánh dấu, không trừ kho" });
    await consume.or(onlyMark).first().waitFor();
    const canConsume = await consume.isEnabled().catch(() => false);
    await (canConsume ? consume : onlyMark).click();
    await page.getByRole("button", { name: /^Bỏ đánh dấu đã ăn: / }).first().waitFor();
    return canConsume ? "đã trừ kho" : "món không có trong kho, chỉ đánh dấu";
  });

  await step(page, "6. Báo cáo: lãng phí và dinh dưỡng tuần", async () => {
    await page.goto(APP + "/reports");
    await page.getByRole("heading", { name: "Lãng phí thực phẩm" }).waitFor();
    await page.getByRole("heading", { name: "Dinh dưỡng tuần" }).waitFor();
  });

  await step(page, "7. Gợi ý: Dành cho bạn có món kèm lý do", async () => {
    await page.goto(APP + "/recipes");
    await page.getByRole("heading", { name: "Dành cho bạn" }).waitFor();
    const cards = page.locator("section[aria-labelledby='recipes-for-you-title'] a[href^='/recipes/']");
    await cards.first().waitFor();
    return `${await cards.count()} liên kết món`;
  });

  await step(page, "8. Tìm kiếm không dấu \"com tron\" ra Cơm trộn Hàn Quốc", async () => {
    await page.getByRole("searchbox").fill("com tron");
    await page.locator(".recipes-results__list").getByText("Cơm trộn Hàn Quốc").first().waitFor();
    await page.getByRole("searchbox").fill("dau hu");
    await page.locator(".recipes-results__list").getByText(/đậu hũ/i).first().waitFor();
    return await page.locator(".recipes-results__count").textContent();
  });

  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  admin.setDefaultTimeout(20_000);
  await step(admin, "9. Admin: đăng nhập → thống kê → công thức → bộ lọc Đã xóa", async () => {
    await login(admin, ACC.admin());
    await admin.waitForURL(/\/admin/);
    await admin.getByRole("heading", { name: "Tổng quan" }).waitFor();
    await admin.goto(APP + "/admin/recipes");
    await admin.getByLabel("Tìm món, nguyên liệu, ẩm thực").fill("han quoc");
    await admin.locator(".ad-table").getByText("Cơm trộn Hàn Quốc").first().waitFor();
    await admin.getByRole("button", { name: "Đã xóa" }).click();
    await admin.getByLabel("Tìm món, nguyên liệu, ẩm thực").fill("");
    await admin.locator(".ad-table, .ui-empty").first().waitFor();
  });

  check("Không có lỗi JavaScript trên trang", errors.length === 0, errors.slice(0, 2).join(" | "));
  await browser.close();
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `${failed}/${results.length} mục LỖI` : `Tất cả ${results.length} mục ĐẠT`);
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error.message); process.exit(1); });
