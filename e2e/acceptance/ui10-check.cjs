// Nghiệm thu UI-10 (Quản trị: Người dùng, Kiểm duyệt, Nhật ký). node ui10-check.cjs <thư mục ảnh docs>
// Đăng nhập Admin bằng ADMIN_EMAIL/ADMIN_PASSWORD trong .env (không in ra). Bài thử "Thử UI10" của demo tạo qua API, Admin xóa qua giao diện.
// Cuối lượt: demo được mở khóa; chỉ xóa các dòng nhật ký do lượt chạy này tạo (id thu được, createdAt >= lúc bắt đầu).
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const admin = require("./lib/admin-env.cjs")();
const seedPost = require("./lib/ui10-seed.cjs");
const [OUT] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const DEMO = { email: ACC.demo().email, password: ACC.demo().password };
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const sql = (query) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'],
  { cwd: ACC.ROOT, input: query }).toString().trim();
const cloudinaryCount = () => execFileSync("docker", ["compose", "exec", "-T", "backend", "node", "-e",
  'const c=require("cloudinary").v2;c.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});c.api.resources({type:"upload",prefix:"nouri/posts",max_results:50}).then(r=>console.log(r.resources.length))'],
{ cwd: ACC.ROOT }).toString().trim();
const vnTime = (iso) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}`;
};
const contrastOf = (el) => {
  const parse = (c) => c.match(/[\d.]+/g).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fg = parse(getComputedStyle(el).color);
  let node = el, bg = null;
  while (node && node.nodeType === 1) { const c = parse(getComputedStyle(node).backgroundColor); if (c.length < 4 || c[3] > 0.9) { bg = c; break; } node = node.parentElement; }
  bg = bg || [255, 255, 255];
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};
const apiLogin = async (body) => fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function loginState(browser, { email, password }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(APP + "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

(async () => {
  const runStart = sql("SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"');");
  const browser = await chromium.launch();
  const errors = [];
  const adminToken = (await (await apiLogin(admin)).json()).token;
  const call = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${adminToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return res.status === 204 ? null : res.json();
  };
  const demoUser = async () => (await call("GET", `/admin/users?search=${encodeURIComponent(DEMO.email)}&pageSize=50`)).items.find((u) => u.email === DEMO.email);
  if ((await demoUser()).locked) await call("PATCH", `/admin/users/${(await demoUser()).id}/lock`, { locked: false });
  // Bài "Thử UI10" còn sót từ lần chạy trước: demo tự xóa (không ghi nhật ký Admin).
  {
    const demoToken = (await (await apiLogin(DEMO)).json()).token;
    const feed = await (await fetch(`${API}/community?pageSize=50`, { headers: { Authorization: `Bearer ${demoToken}` } })).json();
    for (const post of (feed.items || feed.posts || feed).filter((p) => (p.content || "").startsWith("Thử UI10"))) {
      await fetch(`${API}/community/${post.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${demoToken}` } });
    }
  }
  const demo = await demoUser();
  const me = (await (await fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${adminToken}` } })).json());

  const adminState = await loginState(browser, admin);
  const open = async (state, path, w, theme = "light", setup) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::|width\(0\) and height\(0\)/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    if (setup) await setup(page);
    await page.goto(APP + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    return { ctx, page };
  };
  const themeName = (t) => (t === "light" ? "sang" : "toi");
  const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const dialogOf = (page) => page.locator("dialog.ui-dialog[open]");

  // 1) Người dùng: ảnh 4 cỡ; bảng thành thẻ ≤ 760px; dòng của mình không có nút khóa.
  for (const w of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(adminState, "/admin/users", w, theme);
      await page.screenshot({ path: `${OUT}/nguoi-dung_${w}_${themeName(theme)}.png`, fullPage: true });
      check(`Người dùng ${w}px ${theme}: không cuộn ngang, một <main>`, (await noOverflow(page)) <= 0 && (await page.locator("main").count()) === 1);
      if (w === 390) check(`Người dùng 390px ${theme}: bảng thành thẻ`, (await page.locator(".ad-row").first().evaluate((el) => getComputedStyle(el).display)) === "grid");
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open(adminState, "/admin/users", 1440);
    const users = await call("GET", "/admin/users?pageSize=50");
    const headers = await page.locator(".ad-table th").allTextContents();
    check("Bảng có đủ cột: người dùng, vai trò, ngày tạo, bài viết, thực đơn, trạng thái", ["Người dùng", "Vai trò", "Ngày tạo", "Bài viết", "Thực đơn", "Trạng thái"].every((h) => headers.includes(h)));
    const demoRow = page.locator(".ad-row", { hasText: DEMO.email });
    const demoText = await demoRow.innerText();
    check("Dòng demo: số bài viết/thực đơn khớp API, \"Đang hoạt động\"", demoText.includes("Người dùng") && demoText.includes("Đang hoạt động")
      && (await demoRow.locator("td").nth(3).innerText()).trim() === String(demo.postCount) && (await demoRow.locator("td").nth(4).innerText()).trim() === String(demo.mealPlanCount));
    const selfRow = page.locator(".ad-row", { hasText: me.email });
    check("Dòng của chính mình: không có nút khóa, có giải thích", (await selfRow.getByRole("button").count()) === 0 && (await selfRow.innerText()).includes("không tự khóa được"));
    check("Tổng số tài khoản khớp API", (await page.locator(".ad-pager__count").innerText()).startsWith(`${users.total} tài khoản`));
    await page.getByLabel("Tìm theo tên hoặc email").fill("demo@");
    await page.waitForFunction(() => document.querySelectorAll(".ad-row").length === 1, null, { timeout: 5000 }).catch(() => {});
    check("Tìm theo email: còn 1 dòng (demo)", (await page.locator(".ad-row").count()) === 1 && (await page.locator(".ad-row").innerText()).includes(DEMO.email));
    await page.getByLabel("Tìm theo tên hoặc email").fill("Minh Anh");
    await page.waitForTimeout(800);
    check("Tìm theo tên: thấy demo (Minh Anh)", (await page.locator(".ad-row", { hasText: DEMO.email }).count()) === 1 && (await page.locator(".ad-row").count()) === 1);
    await page.getByLabel("Tìm theo tên hoặc email").fill("khong-co-ai-xyz");
    await page.waitForTimeout(800);
    check("Tìm không có kết quả: EmptyState", (await page.locator(".ui-empty").count()) === 1);
    await ctx.close();
  }
  // Admin khác + người bị khóa + phân trang (giả lập danh sách, không đổi dữ liệu).
  {
    let template = null;
    const { ctx, page } = await open(adminState, "/admin/users", 1440, "light", (p) => p.route("**/api/admin/users?**", async (route) => {
      const res = await route.fetch(); const json = await res.json();
      template = template || json.items[0];
      json.items.push({ ...template, id: "admin-khac", name: "Quản trị viên 2", email: "admin2@nouri.vn", role: "ADMIN", locked: false, lockedAt: null },
        { ...template, id: "bi-khoa", name: "Người bị khóa", email: "khoa@nouri.vn", role: "USER", locked: true, lockedAt: "2026-11-01T17:30:00.000Z" });
      json.total = 45;
      return route.fulfill({ response: res, json });
    }));
    const other = page.locator(".ad-row", { hasText: "admin2@nouri.vn" });
    check("Admin khác: không có nút khóa, giải thích ngắn", (await other.getByRole("button").count()) === 0 && (await other.innerText()).includes("không khóa được Admin khác"));
    const locked = await page.locator(".ad-row", { hasText: "khoa@nouri.vn" }).innerText();
    check("Người đã khóa: \"Đã khóa\" kèm thời điểm khóa (giờ Việt Nam) và nút \"Mở khóa\"", locked.includes("Đã khóa") && locked.includes("từ 00:30, 02/11/2026")
      && (await page.getByRole("button", { name: "Mở khóa khoa@nouri.vn" }).count()) === 1, locked.replace(/\n/g, " "));
    check("Phân trang: 45 tài khoản, 3 trang, có nút trang sau", (await page.locator(".ad-pager__count").innerText()).includes("trang 1/3") && await page.getByRole("button", { name: "Trang sau" }).isEnabled());
    await page.getByRole("button", { name: "Trang sau" }).click();
    await page.waitForTimeout(500);
    check("Bấm trang sau: sang trang 2", (await page.locator(".ad-pager__count").innerText()).includes("trang 2/3"));
    await ctx.close();
  }
  // API trả 400/403 (giả lập): báo lỗi của máy chủ, trạng thái không đổi.
  for (const [status, message] of [[400, "Không thể tự khóa tài khoản của mình."], [403, "Không thể khóa tài khoản Admin khác."]]) {
    const { ctx, page } = await open(adminState, "/admin/users", 1440, "light", (p) => p.route("**/api/admin/users/*/lock", (route) => route.fulfill({ status, json: { message } })));
    await page.getByRole("button", { name: `Khóa ${DEMO.email}` }).click();
    await dialogOf(page).getByRole("button", { name: "Khóa tài khoản" }).click();
    await page.locator(".ui-error, [role='alert']", { hasText: message }).first().waitFor({ timeout: 5000 }).catch(() => {});
    const shown = await page.locator("main").innerText();
    check(`Khóa bị từ chối ${status}: hiện thông báo của máy chủ, demo vẫn hoạt động`, shown.includes(message) && !(await demoUser()).locked);
    if (status === 403) await page.screenshot({ path: `${OUT}/khoa-bi-tu-choi_1440_sang.png` });
    await ctx.close();
  }

  // 2) Luồng thật: khóa demo → demo bị đăng xuất/chặn → mở khóa.
  {
    const demoState = await loginState(browser, DEMO);
    const demoPage = await open(demoState, "/pantry", 390);
    check("Trước khi khóa: demo dùng được trang Kho", new URL(demoPage.page.url()).pathname === "/pantry");
    const { ctx, page } = await open(adminState, "/admin/users", 1440);
    await page.getByRole("button", { name: `Khóa ${DEMO.email}` }).click();
    const dialog = dialogOf(page);
    await dialog.waitFor();
    const text = await dialog.innerText();
    check("Hộp xác nhận khóa: nêu email, nói rõ bị đăng xuất và không dùng được ứng dụng", text.includes(`Khóa ${DEMO.email}?`) && text.includes("bị đăng xuất") && text.includes("không đăng nhập hay dùng được ứng dụng"));
    await page.screenshot({ path: `${OUT}/xac-nhan-khoa_1440_sang.png` });
    await dialog.getByRole("button", { name: "Hủy" }).click();
    check("Hủy: không khóa", !(await demoUser()).locked);
    for (const theme of ["dark", "light"]) {
      const shot = await open(adminState, "/admin/users", 390, theme);
      await shot.page.getByRole("button", { name: `Khóa ${DEMO.email}` }).click();
      await dialogOf(shot.page).waitFor();
      await shot.page.waitForTimeout(200);
      await shot.page.screenshot({ path: `${OUT}/xac-nhan-khoa_390_${themeName(theme)}.png` });
      await shot.page.keyboard.press("Escape");
      await shot.ctx.close();
    }
    {
      const shot = await open(adminState, "/admin/users", 1440, "dark");
      await shot.page.getByRole("button", { name: `Khóa ${DEMO.email}` }).click();
      await dialogOf(shot.page).waitFor();
      await shot.page.waitForTimeout(200);
      await shot.page.screenshot({ path: `${OUT}/xac-nhan-khoa_1440_toi.png` });
      await shot.page.keyboard.press("Escape");
      await shot.ctx.close();
    }
    check("Esc đóng hộp xác nhận, không khóa", !(await demoUser()).locked);
    await page.getByRole("button", { name: `Khóa ${DEMO.email}` }).click();
    await dialogOf(page).getByRole("button", { name: "Khóa tài khoản" }).click();
    await page.locator(".ui-toast", { hasText: "Đã khóa" }).waitFor();
    const row = await page.locator(".ad-row", { hasText: DEMO.email }).innerText();
    const lockedNow = await demoUser();
    check("Khóa: toast, dòng \"Đã khóa từ …\" đúng giờ Việt Nam, API locked", lockedNow.locked && row.includes("Đã khóa") && row.includes(`từ ${vnTime(lockedNow.lockedAt)}`), row.replace(/\n/g, " "));
    check("Sau khi khóa: nút đổi thành \"Mở khóa\"", (await page.getByRole("button", { name: `Mở khóa ${DEMO.email}` }).count()) === 1);
    await page.screenshot({ path: `${OUT}/nguoi-dung-da-khoa_1440_sang.png`, fullPage: true });

    // Demo đang mở ứng dụng: thao tác tiếp theo → bị đăng xuất, về /login?locked=1 có giải thích.
    await demoPage.page.getByRole("button", { name: "Menu điều hướng" }).click().catch(() => {});
    await demoPage.page.getByRole("link", { name: "Thực đơn" }).first().click();
    await demoPage.page.waitForURL("**/login?locked=1", { timeout: 15000 }).catch(() => {});
    await demoPage.page.waitForLoadState("networkidle").catch(() => {});
    const loginText = await demoPage.page.locator("main").innerText();
    const tokenLeft = await demoPage.page.evaluate(() => Object.keys(localStorage).filter((k) => /token|user/i.test(k)).length + Object.keys(sessionStorage).filter((k) => /token|user/i.test(k)).length);
    check("Demo đang dùng: bị đăng xuất (xóa phiên), về /login?locked=1 kèm giải thích", demoPage.page.url().endsWith("/login?locked=1") && loginText.includes("đã bị khóa nên đã bị đăng xuất") && tokenLeft === 0,
      demoPage.page.url());
    await demoPage.page.screenshot({ path: `${OUT}/dang-nhap-bi-khoa_390_sang.png`, fullPage: true });
    await demoPage.page.getByLabel("Email").fill(DEMO.email);
    await demoPage.page.getByLabel("Mật khẩu", { exact: true }).fill(DEMO.password);
    await demoPage.page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await demoPage.page.waitForTimeout(1200);
    check("Demo đăng nhập lại khi đang khóa: bị chặn, báo tài khoản bị khóa", demoPage.page.url().includes("/login") && (await demoPage.page.locator("main").innerText()).includes("Tài khoản này đã bị khóa"));
    await demoPage.ctx.close();
    const apiStatus = (await fetch(`${API}/pantry`, { headers: { Authorization: `Bearer ${demoState.origins[0].localStorage.find((e) => /token/i.test(e.name))?.value}` } })).status;
    check("Token cũ của demo gọi API → 403", apiStatus === 403);

    await page.getByRole("button", { name: `Mở khóa ${DEMO.email}` }).click();
    const unlock = dialogOf(page);
    check("Hộp xác nhận mở khóa: nêu email", (await unlock.innerText()).includes(`Mở khóa ${DEMO.email}?`));
    await unlock.getByRole("button", { name: "Mở khóa tài khoản" }).click();
    await page.locator(".ui-toast", { hasText: "Đã mở khóa" }).waitFor();
    check("Mở khóa: toast, \"Đang hoạt động\", API mở khóa, demo đăng nhập lại được", !(await demoUser()).locked
      && (await page.locator(".ad-row", { hasText: DEMO.email }).innerText()).includes("Đang hoạt động") && (await apiLogin(DEMO)).status === 200);
    await ctx.close();
  }

  // 3) Kiểm duyệt: demo đăng bài 2 ảnh + công thức + 2 bình luận, Admin thích; Admin xóa bình luận rồi xóa bài.
  const postId = await seedPost();
  check("Bài thử: 2 ảnh trên Cloudinary (nouri/posts)", cloudinaryCount() === "2");
  for (const w of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(adminState, "/admin/moderation", w, theme);
      await page.screenshot({ path: `${OUT}/kiem-duyet_${w}_${themeName(theme)}.png`, fullPage: true });
      check(`Kiểm duyệt ${w}px ${theme}: không cuộn ngang, một <main>`, (await noOverflow(page)) <= 0 && (await page.locator("main").count()) === 1);
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open(adminState, "/admin/moderation", 1440);
    const api = (await call("GET", "/admin/community/posts?pageSize=10")).items.find((p) => p.id === postId);
    const card = page.locator(".ad-post").first();
    const text = await card.innerText();
    check("Bài: tác giả (tên, email), thời gian thật giờ Việt Nam, nội dung", text.includes("Minh Anh") && text.includes(DEMO.email) && text.includes(vnTime(api.createdAt)) && text.includes("Thử UI10: bữa tối nay"));
    const srcs = await card.locator(".ad-post > * img, .cm-post-images img, img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src")).filter((s) => /cloudinary/.test(s)));
    check("Ảnh bài viết qua optimizedImageUrl (f_auto,q_auto, w_640)", srcs.length === 2 && srcs.every((s) => s.includes("f_auto,q_auto") && s.includes("w_640")), srcs[0]);
    check("Công thức đính kèm, 1 lượt thích, 2 bình luận", text.includes("Cá kho tộ") && text.includes("1 lượt thích") && text.includes("2 bình luận") && (await card.locator(".ad-comment").count()) === 2);
    await page.getByRole("button", { name: "Xóa bình luận của Minh Anh" }).first().click();
    const dlg = dialogOf(page);
    await dlg.waitFor();
    const ctext = await dlg.innerText();
    check("Xóa bình luận: hộp xác nhận nêu tác giả và thông báo liên quan", ctext.includes("Xóa bình luận của Minh Anh?") && ctext.includes("thông báo"), ctext.replace(/\n/g, " "));
    await page.screenshot({ path: `${OUT}/xac-nhan-xoa-binh-luan_1440_sang.png` });
    await dlg.getByRole("button", { name: "Xóa bình luận" }).click();
    await page.locator(".ui-toast", { hasText: "Đã xóa bình luận" }).waitFor();
    await page.waitForTimeout(500);
    const after = (await call("GET", "/admin/community/posts?pageSize=10")).items.find((p) => p.id === postId);
    check("Xóa bình luận: còn 1 bình luận (giao diện và API)", (await card.locator(".ad-comment").count()) === 1 && after.commentCount === 1);
    await page.getByRole("button", { name: "Xóa bài của Minh Anh" }).click();
    await dlg.waitFor();
    const ptext = await dlg.innerText();
    check("Xóa bài: hộp xác nhận nói rõ xóa kèm 2 ảnh (cả Cloudinary), 1 bình luận, 1 lượt thích, thông báo liên quan",
      ptext.includes("2 ảnh (xóa cả trên Cloudinary)") && ptext.includes("1 bình luận") && ptext.includes("1 lượt thích") && ptext.includes("thông báo liên quan"), ptext.replace(/\n/g, " "));
    await page.screenshot({ path: `${OUT}/xac-nhan-xoa-bai_1440_sang.png` });
    {
      const shot = await open(adminState, "/admin/moderation", 390, "dark");
      await shot.page.getByRole("button", { name: "Xóa bài của Minh Anh" }).click();
      await dialogOf(shot.page).waitFor();
      await shot.page.waitForTimeout(200);
      await shot.page.screenshot({ path: `${OUT}/xac-nhan-xoa-bai_390_toi.png` });
      await shot.page.keyboard.press("Escape");
      await shot.ctx.close();
    }
    await dlg.getByRole("button", { name: "Xóa bài" }).click();
    await page.locator(".ui-toast", { hasText: "Đã xóa bài" }).waitFor();
    await page.locator(".ui-empty").waitFor({ timeout: 5000 }).catch(() => {});
    check("Xóa bài: không còn bài, EmptyState", (await page.locator(".ad-post").count()) === 0 && (await page.locator(".ui-empty").innerText()).includes("chưa có bài viết"));
    await page.screenshot({ path: `${OUT}/kiem-duyet-trong_1440_sang.png`, fullPage: true });
    await ctx.close();
    let left = cloudinaryCount();
    for (let i = 0; i < 5 && left !== "0"; i++) { await new Promise((r) => setTimeout(r, 2000)); left = cloudinaryCount(); }
    check("Ảnh của bài đã bị xóa trên Cloudinary (nouri/posts trống)", left === "0", left);
    check("DB: không còn bài, bình luận, thông báo liên quan", sql(`SELECT (SELECT count(*) FROM "CommunityPost" WHERE id='${postId}') + (SELECT count(*) FROM "CommunityComment" WHERE "postId"='${postId}') + (SELECT count(*) FROM "Notification" WHERE "relatedId"='${postId}');`) === "0");
  }
  {
    const { ctx, page } = await open(adminState, "/admin/moderation", 1440, "light", (p) => p.route("**/api/admin/community/posts?**", (route) => route.fulfill({ status: 500, json: { message: "Lỗi" } })));
    await page.locator(".ui-error, [role='alert']").first().waitFor({ timeout: 8000 }).catch(() => {});
    check("Kiểm duyệt lỗi tải: thông báo + Thử lại", (await page.getByRole("button", { name: "Thử lại" }).count()) === 1);
    await ctx.close();
  }

  // 4) Nhật ký: các thao tác vừa làm đã được ghi; tên tiếng Việt; lọc; link; chỉ xem.
  const logs = (await call("GET", "/admin/audit-logs?pageSize=50")).items.filter((l) => l.createdAt >= runStart);
  const actions = logs.map((l) => l.action);
  check("API nhật ký: đúng 4 dòng mới, mới nhất trước (xóa bài, xóa bình luận, mở khóa, khóa)",
    JSON.stringify(actions) === JSON.stringify(["POST_DELETE", "COMMENT_DELETE", "USER_UNLOCK", "USER_LOCK"]), actions.join(","));
  for (const w of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(adminState, "/admin/audit-logs", w, theme);
      await page.screenshot({ path: `${OUT}/nhat-ky_${w}_${themeName(theme)}.png`, fullPage: true });
      check(`Nhật ký ${w}px ${theme}: không cuộn ngang, một <main>`, (await noOverflow(page)) <= 0 && (await page.locator("main").count()) === 1);
      if (w === 390) check(`Nhật ký 390px ${theme}: bảng thành thẻ`, (await page.locator(".ad-row").first().evaluate((el) => getComputedStyle(el).display)) === "grid");
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open(adminState, "/admin/audit-logs", 1440);
    const rows = page.locator(".ad-row");
    const texts = await rows.allInnerTexts();
    const flat = texts.map((t) => t.replace(/\s+/g, " "));
    check("Hành động tiếng Việt: Xóa bài viết, Xóa bình luận, Mở khóa tài khoản, Khóa tài khoản", ["Xóa bài viết", "Xóa bình luận", "Mở khóa tài khoản", "Khóa tài khoản"].every((l, i) => flat[i].includes(l)), flat.slice(0, 4).join(" || "));
    check("Đối tượng: \"Bài viết của demo…\", \"Bình luận của demo…\", email", flat[0].includes(`Bài viết của ${DEMO.email}`) && flat[1].includes(`Bình luận của ${DEMO.email}`) && flat[2].includes(DEMO.email) && flat[3].includes(DEMO.email));
    check("Chi tiết xóa bài: 2 ảnh, 1 bình luận, 1 lượt thích, có công thức", flat[0].includes("2 ảnh, 1 bình luận, 1 lượt thích, có công thức đính kèm"), flat[0]);
    check("Thời gian giờ Việt Nam khớp API, người thực hiện = Admin", flat[0].includes(vnTime(logs[0].createdAt)) && flat[0].includes(me.email));
    check("Bài đã xóa: không có link; tài khoản còn tồn tại: có link", (await rows.nth(0).locator("a").count()) === 0 && (await rows.nth(3).locator("a").count()) === 1);
    check("Chỉ xem: bảng nhật ký không có nút sửa/xóa", (await page.locator(".ad-table--audit button").count()) === 0);
    await page.getByLabel("Hành động").selectOption({ label: "Khóa tài khoản" });
    await page.waitForTimeout(800);
    const lockRows = await rows.allInnerTexts();
    check("Lọc theo hành động \"Khóa tài khoản\": chỉ dòng khóa", lockRows.length >= 1 && lockRows.every((t) => t.includes("Khóa tài khoản") && !t.includes("Mở khóa")), `${lockRows.length} dòng`);
    await page.screenshot({ path: `${OUT}/nhat-ky-loc_1440_sang.png`, fullPage: true });
    await page.getByLabel("Hành động").selectOption("");
    const actorOptions = await page.locator("#ad-audit-actor option").allTextContents();
    check("Bộ lọc người thực hiện: có Admin", actorOptions.some((o) => o.includes(me.email)));
    await page.getByLabel("Người thực hiện").selectOption({ label: actorOptions.find((o) => o.includes(me.email)) });
    await page.waitForTimeout(800);
    const total = (await call("GET", `/admin/audit-logs?actorId=${me.id}&pageSize=1`)).total;
    check("Lọc theo người thực hiện: tổng khớp API", (await page.locator(".ad-pager__count").innerText()).startsWith(`${total} thao tác`));
    await page.getByLabel("Hành động").selectOption("RECIPE_DELETE");
    await page.waitForTimeout(800);
    const emptyFilter = (await call("GET", `/admin/audit-logs?actorId=${me.id}&action=RECIPE_DELETE&pageSize=1`)).total === 0;
    if (emptyFilter) check("Lọc không có kết quả: EmptyState \"không có thao tác nào khớp\"", (await page.locator(".ui-empty").innerText()).includes("khớp bộ lọc"));
    await page.getByLabel("Hành động").selectOption("");
    await page.getByLabel("Người thực hiện").selectOption("");
    await page.waitForTimeout(800);
    await rows.nth(3).locator("a").click();
    await page.waitForURL("**/admin/users?search=*");
    await page.waitForTimeout(800);
    check("Link đối tượng: mở /admin/users đã điền sẵn email, thấy đúng tài khoản", (await page.getByLabel("Tìm theo tên hoặc email").inputValue()) === DEMO.email
      && (await page.locator(".ad-row").count()) === 1);
    await ctx.close();
  }

  // 5) Tương phản, Tab, phông, 320px cho 3 trang.
  for (const [path, name] of [["/admin/users", "Người dùng"], ["/admin/moderation", "Kiểm duyệt"], ["/admin/audit-logs", "Nhật ký"]]) {
    const seeded = path === "/admin/moderation" ? await seedPost() : null;
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(adminState, path, 1440, theme);
      const sels = [".ad-tab", ".ad-tab.is-active", ".ad-section__title", ".ad-table th", ".ad-sub", ".ad-row__strong", ".ad-note", ".ad-status", ".ad-pager__count",
        ".ad-filter-field__label", ".ad-action", ".ad-row__details", ".ad-post__content", ".ad-post__stats", ".ad-comment__text", ".ui-link", ".ui-input"];
      const pairs = await page.evaluate(`(${(fn, list) => list.flatMap((sel) => [...document.querySelectorAll(sel)].slice(0, 1).map((el) => [sel, Math.round(fn(el) * 100) / 100]))})(${contrastOf.toString()}, ${JSON.stringify(sels)})`);
      const weak = pairs.filter(([, r]) => r < 4.5);
      check(`${name} tương phản chữ ${theme}: ${pairs.length} cặp ≥ 4.5:1`, pairs.length >= 5 && weak.length === 0, (weak.length ? weak : pairs).map(([s, r]) => `${s}=${r}`).join(" "));
      if (theme === "light") {
        const hidden = []; let stops = 0;
        for (let i = 0; i < 80; i++) {
          await page.keyboard.press("Tab"); await page.waitForTimeout(40);
          let info = await page.evaluate(() => {
            const el = document.activeElement; if (!el || el === document.body) return null;
            const cs = getComputedStyle(el);
            return { name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30), main: Boolean(el.closest("main")),
              visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
          });
          if (!info) break;
          if (info.main && !info.visible) { await page.waitForTimeout(250); info = { ...info, visible: await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== "none" || s.boxShadow !== "none"; }) }; }
          if (info.main) { stops++; if (!info.visible) hidden.push(info.name); }
        }
        check(`${name}: Tab ${stops} điểm dừng đều thấy focus`, stops >= 5 && hidden.length === 0, hidden.slice(0, 5).join(" | "));
        const client = await ctx.newCDPSession(page);
        await client.send("DOM.enable"); await client.send("CSS.enable");
        const { root } = await client.send("DOM.getDocument", { depth: -1 });
        const issues = [];
        for (const selector of ["h1", "h1 em", ".ad-section__title"]) {
          const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
          for (const nodeId of nodeIds) {
            const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
            if (!fonts.every((f) => /Fraunces/.test(f.familyName) && f.isCustomFont)) issues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
          }
        }
        const bodyIssues = [];
        for (const selector of [".ad-row__strong", ".ad-table td", ".ad-comment__text", ".ad-action"]) {
          const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
          for (const nodeId of nodeIds.slice(0, 3)) {
            const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
            if (!fonts.every((f) => /Be Vietnam Pro/.test(f.familyName) && f.isCustomFont)) bodyIssues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
          }
        }
        check(`${name}: tiêu đề có dấu chồng vẽ bằng Fraunces, chữ thân (Người dùng, Kiểm duyệt, Nhật ký…) bằng Be Vietnam Pro`, issues.length === 0 && bodyIssues.length === 0, [...issues, ...bodyIssues].join("; "));
        const narrow = await open(adminState, path, 320);
        check(`${name}: 320px không cuộn ngang`, (await noOverflow(narrow.page)) <= 0);
        const active = await narrow.page.locator(".ad-tab.is-active").evaluate((el) => { const r = el.getBoundingClientRect(); const n = el.parentElement.getBoundingClientRect(); return r.left >= n.left - 1 && r.right <= n.right + 1; });
        check(`${name}: 320px tab đang chọn nằm trọn trong thanh tab`, active);
        await narrow.ctx.close();
      }
      await ctx.close();
    }
    if (seeded) {
      const demoToken = (await (await apiLogin(DEMO)).json()).token;
      await fetch(`${API}/community/${seeded}`, { method: "DELETE", headers: { Authorization: `Bearer ${demoToken}` } });
    }
  }

  // 6) Dọn: demo mở khóa; không còn bài thử/ảnh; xóa đúng các dòng nhật ký do lượt này tạo.
  const finalDemo = await demoUser();
  if (finalDemo.locked) await call("PATCH", `/admin/users/${finalDemo.id}/lock`, { locked: false });
  check("tài khoản demo đang mở khóa (API + DB)", !(await demoUser()).locked && sql(`SELECT count(*) FROM "User" WHERE email='${DEMO.email}' AND "lockedAt" IS NULL;`) === "1");
  check("Không còn bài viết thử, nouri/posts trống", sql(`SELECT count(*) FROM "CommunityPost" WHERE content LIKE 'Thử UI10%';`) === "0" && cloudinaryCount() === "0");
  const ownRows = (await call("GET", "/admin/audit-logs?pageSize=50")).items.filter((l) => l.createdAt >= runStart && l.actor.id === me.id);
  const ids = ownRows.map((l) => `'${l.id}'`).join(",");
  if (ids) sql(`DELETE FROM "AdminAuditLog" WHERE id IN (${ids}) AND "createdAt" >= '${runStart}';`);
  check(`Xóa ${ownRows.length} dòng nhật ký do lượt thử tạo (không đụng dòng khác)`, sql(`SELECT count(*) FROM "AdminAuditLog" WHERE "createdAt" >= '${runStart}';`) === "0");
  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
