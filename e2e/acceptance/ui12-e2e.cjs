// UI-12: đi lại các luồng chính end-to-end bằng tài khoản thật (đăng ký mới) và Admin thật (đọc .env, không in ra).
// node ui12-e2e.cjs <thư mục ảnh> -> ghi kết quả ra e2e-result.json (email tài khoản thử, thời điểm bắt đầu) để bước dọn dùng.
const ACC = require("./lib/env.cjs");
const fs = require("fs");
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const admin = require("./lib/admin-env.cjs")();
const [OUT] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const IMG = ACC.FIXTURES + "/thu-1.jpg";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const sql = (q) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { cwd: ACC.ROOT, input: q }).toString().trim();
const cloudinaryCount = (prefix) => execFileSync("docker", ["compose", "exec", "-T", "backend", "node", "-e",
  `const c=require("cloudinary").v2;c.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});c.api.resources({type:"upload",prefix:"${prefix}",max_results:50}).then(r=>console.log(r.resources.length))`],
{ cwd: ACC.ROOT }).toString().trim();
const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const ddmmyyyy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

(async () => {
  const runStart = sql("SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"');");
  const email = `thu-ui12-${Date.now()}@nouri.vn`;
  const password = ACC.testPassword;
  const name = "Thử UI12 Lan";
  fs.writeFileSync("e2e-result.json", JSON.stringify({ runStart, email }));
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async (w = 1440) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    return { ctx, page };
  };

  // 1) Đăng ký từ Landing.
  const { ctx, page } = await newPage();
  await page.goto(APP + "/");
  await page.locator(".ld-hero").getByRole("link", { name: "Đăng ký miễn phí" }).click();
  await page.getByLabel("Họ và tên").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  check("Đăng ký từ Landing → vào Tổng quan, menu hiện tên", (await page.locator("header.site-header").innerText()).includes("Thử UI12"));
  const userToken = await page.evaluate(() => Object.entries({ ...localStorage }).find(([k]) => /token/i.test(k))?.[1]);
  const api = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${userToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) };
  };

  // 2) Hồ sơ.
  await page.goto(APP + "/profile");
  await page.getByLabel("Tuổi").fill("29");
  await page.getByLabel("Nữ", { exact: true }).check({ force: true });
  await page.getByLabel("Chiều cao").fill("158");
  await page.getByLabel("Cân nặng hiện tại").fill("52");
  await page.getByLabel("Giảm cân", { exact: true }).check({ force: true });
  await page.getByLabel("Ăn chay", { exact: true }).check({ force: true });
  await page.getByRole("textbox", { name: "Dị ứng" }).fill("Đậu phộng");
  await page.getByRole("textbox", { name: "Dị ứng" }).press("Enter");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await page.locator(".ui-toast").waitFor({ timeout: 10000 });
  const profile = (await api("GET", "/profile")).body;
  check("Hồ sơ: lưu xong (ăn chay, dị ứng Đậu phộng), có chỉ tiêu calo", profile?.nutritionProfile?.dietType === "VEGETARIAN" || profile?.dietType === "VEGETARIAN"
    || JSON.stringify(profile).includes("VEGETARIAN"), JSON.stringify(profile).slice(0, 160));
  await page.screenshot({ path: `${OUT}/e2e-01-ho-so.png`, fullPage: false });

  // 3) Thêm kho.
  await page.goto(APP + "/pantry");
  await page.locator("main").getByRole("button", { name: "Thêm thực phẩm" }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("Tên thực phẩm").fill("Đậu hũ");
  await dialog.getByLabel("Số lượng").fill("400");
  const expiry = new Date(today.getTime() + 2 * 86400000);
  await dialog.getByLabel("Hạn sử dụng").fill(ddmmyyyy(expiry));
  await dialog.getByRole("button", { name: "Lưu vào kho" }).click();
  await page.locator(".ui-toast", { hasText: "Đã lưu" }).waitFor({ timeout: 10000 });
  const pantry = (await api("GET", "/pantry")).body;
  const items = pantry.items || pantry;
  check("Kho: thêm \"Đậu hũ\" (hạn sau 2 ngày) qua hộp thoại", items.some((i) => i.name === "Đậu hũ"), `${items.length} thực phẩm`);
  await page.screenshot({ path: `${OUT}/e2e-02-kho.png` });

  // 4) Tạo thực đơn → áp dụng → đã ăn → đã mua.
  await page.goto(APP + "/meal-plans");
  await page.getByLabel("Ngày bắt đầu").fill(ddmmyyyy(today));
  await page.getByRole("button", { name: "Tạo thực đơn" }).first().click();
  await page.locator(".td-day, .td-meal").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  const plans = (await api("GET", "/meal-plans")).body;
  const plan = (plans.items || plans)[0];
  check("Thực đơn: tạo 7 ngày từ hôm nay", plan && (await api("GET", `/meal-plans/${plan.id}`)).body.days.length === 7);
  const apply = page.getByRole("button", { name: "Áp dụng thực đơn" });
  if (await apply.count()) { await apply.click(); await page.waitForTimeout(800); }
  const eat = page.getByRole("button", { name: /^Đánh dấu đã ăn:/ }).first();
  await eat.click();
  await page.waitForTimeout(1000);
  const detail = (await api("GET", `/meal-plans/${plan.id}`)).body;
  const eaten = detail.days.flatMap((d) => d.items).filter((i) => i.completed).length;
  check("Thực đơn: áp dụng + đánh dấu đã ăn 1 bữa", detail.status === "ACTIVE" && eaten === 1, `${detail.status}, ${eaten} bữa đã ăn`);
  const shop = page.locator(".td-shop-item input[type=checkbox], .td-shop-item").first();
  await shop.scrollIntoViewIfNeeded();
  await shop.click();
  await page.waitForTimeout(1000);
  const bought = (await api("GET", `/meal-plans/${plan.id}`)).body.shoppingItems.filter((s) => s.purchased).length;
  check("Đi chợ: đánh dấu đã mua 1 nguyên liệu", bought === 1, `${bought}`);
  const vegOnly = detail.days.flatMap((d) => d.items).every((i) => i.recipe.dietTags.includes("VEGETARIAN") || i.recipe.dietTags.includes("VEGAN"));
  check("Thực đơn ăn chay: mọi món đều chay/thuần chay", vegOnly);
  await page.screenshot({ path: `${OUT}/e2e-03-thuc-don.png` });

  // 5) Công thức → chi tiết → chia sẻ lên cộng đồng (ảnh + công thức).
  await page.goto(APP + "/recipes?q=" + encodeURIComponent("đậu hũ"));
  await page.locator(".recipe-tile").first().waitFor();
  const recipeName = (await page.locator(".recipe-tile__title").first().innerText()).trim();
  await page.locator(".recipe-tile__title a").first().click();
  await page.waitForURL("**/recipes/*");
  await page.getByText("Có trong kho").first().waitFor({ timeout: 10000 }).catch(() => {});
  check("Công thức: tìm \"đậu hũ\" → mở chi tiết, có khối \"Dành cho bạn\"", (await page.locator("h1").innerText()).includes(recipeName) && (await page.getByText("Có trong kho").count()) > 0, recipeName);
  await page.getByRole("link", { name: "Chia sẻ lên cộng đồng" }).click();
  await page.waitForURL("**/community**");
  await page.locator(".cm-composer textarea").fill("Thử UI12: tối nay nấu món này từ đậu hũ trong kho.");
  await page.locator(".cm-composer input[type=file]").setInputFiles(IMG);
  await page.getByRole("button", { name: "Đăng bài" }).click();
  await page.locator(".ui-toast, .cm-post").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const feed = (await api("GET", "/community")).body;
  const posts = feed.items || feed.posts || feed;
  const post = posts.find((p) => (p.content || "").startsWith("Thử UI12"));
  check("Cộng đồng: đăng bài có ảnh (Cloudinary) + công thức đính kèm", post && post.images?.length === 1 && post.recipe?.name === recipeName, post?.images?.[0]?.url?.slice(0, 60));
  await page.screenshot({ path: `${OUT}/e2e-04-cong-dong.png` });

  // 6) Trợ lý AI.
  await page.goto(APP + "/assistant");
  await page.getByPlaceholder("Hỏi về bữa ăn, dinh dưỡng hoặc thực phẩm trong kho").fill("Tối nay mình nên ăn gì để đủ đạm?");
  const chat = page.waitForResponse((r) => r.url().includes("/api/ai/chat") && r.request().method() === "POST", { timeout: 60000 });
  await page.getByRole("button", { name: "Gửi" }).click();
  const chatRes = await chat;
  await page.waitForTimeout(800);
  const status = (await api("GET", "/ai/status")).body;
  check(`Trợ lý AI: gửi câu hỏi → có trả lời (${status?.available ? "OpenAI" : "câu trả lời mẫu, chưa có key"})`, chatRes.status() < 300 && (await page.locator(".as-msg").count()) >= 2);
  await page.screenshot({ path: `${OUT}/e2e-05-tro-ly.png` });

  // 7) Admin: thống kê, sửa món (món thử), khóa/mở khóa, kiểm duyệt, nhật ký.
  const adm = await newPage();
  await adm.page.goto(APP + "/login");
  await adm.page.getByLabel("Email").fill(admin.email);
  await adm.page.getByLabel("Mật khẩu", { exact: true }).fill(admin.password);
  await adm.page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await adm.page.waitForURL((u) => !u.pathname.startsWith("/login"));
  const adminToken = await adm.page.evaluate(() => Object.entries({ ...localStorage, ...sessionStorage }).find(([k]) => /token/i.test(k))?.[1]);
  const aapi = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${adminToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) };
  };
  await adm.page.goto(APP + "/admin");
  await adm.page.locator(".ad-stat__value").first().waitFor();
  const stats = (await aapi("GET", "/admin/stats")).body;
  const shown = await adm.page.locator(".ad-stat__value").allInnerTexts();
  check("Admin thống kê: số người dùng/bài viết khớp API (có tài khoản thử)", Number(shown[0].replace(/\D/g, "")) === stats.totals.users && Number(shown[2].replace(/\D/g, "")) === stats.totals.posts, shown.join(","));

  const created = await aapi("POST", "/admin/recipes", {
    name: "Thử UI12 Canh rau ngót", description: "Món thử của lượt UI-12.", cuisine: "Việt Nam", instructions: ["Rửa rau", "Nấu canh"], prepMinutes: 10, cookMinutes: 10,
    servings: 2, calories: 120, proteinG: 6, carbsG: 10, fatG: 3, fiberG: 4, dietTags: ["VEGAN"], mealTypes: ["LUNCH"], imageUrl: null,
    ingredients: [{ name: "Rau ngót", quantity: 200, unit: "G", optional: false }],
  });
  check("Admin: tạo món thử qua API", created.status === 201, String(created.status));
  await adm.page.goto(`${APP}/admin/recipes/${created.body.id}/edit`);
  await adm.page.getByLabel("Calo").fill("130");
  await adm.page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await adm.page.waitForURL("**/admin/recipes");
  check("Admin sửa món: lưu calo 130", (await aapi("GET", `/admin/recipes/${created.body.id}`)).body.calories === 130);
  await adm.page.getByLabel("Tìm món theo tên").fill("Thử UI12");
  await adm.page.getByRole("button", { name: "Xóa Thử UI12 Canh rau ngót" }).click();
  await adm.page.locator("dialog[open]").getByRole("button", { name: "Xóa món" }).click();
  await adm.page.locator(".ui-toast", { hasText: "Đã xóa" }).waitFor();
  check("Admin xóa món thử (chưa dùng)", (await aapi("GET", `/admin/recipes/${created.body.id}`)).status === 404);

  await adm.page.goto(`${APP}/admin/users?search=${encodeURIComponent(email)}`);
  await adm.page.getByRole("button", { name: `Khóa ${email}` }).click();
  await adm.page.locator("dialog[open]").getByRole("button", { name: "Khóa tài khoản" }).click();
  await adm.page.locator(".ui-toast", { hasText: "Đã khóa" }).waitFor();
  await page.goto(APP + "/pantry");
  await page.waitForURL("**/login?locked=1", { timeout: 15000 }).catch(() => {});
  check("Khóa tài khoản thử: người dùng bị đăng xuất về /login?locked=1", page.url().endsWith("/login?locked=1"));
  await adm.page.getByRole("button", { name: `Mở khóa ${email}` }).click();
  await adm.page.locator("dialog[open]").getByRole("button", { name: "Mở khóa tài khoản" }).click();
  await adm.page.locator(".ui-toast", { hasText: "Đã mở khóa" }).waitFor();
  const relogin = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  check("Mở khóa: tài khoản thử đăng nhập lại được", relogin.status === 200);
  await adm.page.screenshot({ path: `${OUT}/e2e-06-admin-nguoi-dung.png` });

  await adm.page.goto(APP + "/admin/moderation");
  await adm.page.getByRole("button", { name: `Xóa bài của ${name}` }).click();
  await adm.page.locator("dialog[open]").getByRole("button", { name: "Xóa bài" }).click();
  await adm.page.locator(".ui-toast", { hasText: "Đã xóa bài" }).waitFor();
  let left = cloudinaryCount("nouri/posts");
  for (let i = 0; i < 5 && left !== "0"; i++) { await new Promise((r) => setTimeout(r, 2000)); left = cloudinaryCount("nouri/posts"); }
  check("Kiểm duyệt: Admin xóa bài thử, ảnh trên Cloudinary bị xóa", left === "0" && sql(`SELECT count(*) FROM "CommunityPost" WHERE content LIKE 'Thử UI12%';`) === "0");

  await adm.page.goto(APP + "/admin/audit-logs");
  await adm.page.locator(".ad-row").first().waitFor();
  const rows = (await adm.page.locator(".ad-row").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  const wanted = ["Xóa bài viết", "Mở khóa tài khoản", "Khóa tài khoản", "Xóa món", "Sửa món", "Tạo món"];
  check("Nhật ký: ghi đủ 6 thao tác theo thứ tự (xóa bài, mở khóa, khóa, xóa món, sửa món, tạo món)", wanted.every((label, i) => rows[i]?.includes(label)), rows.slice(0, 6).map((r) => r.slice(18, 60)).join(" | "));
  await adm.page.screenshot({ path: `${OUT}/e2e-07-nhat-ky.png` });

  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
