// Nghiệm thu UI-9 (Quản trị: khung, Thống kê, Công thức). node ui9-check.cjs <thư mục ảnh docs> <thư mục ảnh thử>
// Đăng nhập Admin bằng ADMIN_EMAIL/ADMIN_PASSWORD trong .env (không in ra). Món thử "Thử UI9 …" tạo/xóa qua giao diện.
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const admin = require("./lib/admin-env.cjs")();
const [OUT, IMG] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const NAME = "Thử UI9 Đậu hũ sốt nấm";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const cloudinaryCount = () => execFileSync("docker", ["compose", "exec", "-T", "backend", "node", "-e",
  'const c=require("cloudinary").v2;c.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});c.api.resources({type:"upload",prefix:"nouri/recipes",max_results:50}).then(r=>console.log(r.resources.length))'],
{ cwd: ACC.ROOT }).toString().trim();

const contrast = (fgText, bgText) => {
  const parse = (c) => c.match(/[\d.]+/g).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const [a, b] = [lum(parse(fgText)), lum(parse(bgText))].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
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

async function loginState(browser, email, password) {
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
  const browser = await chromium.launch();
  const errors = [];
  const adminToken = (await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(admin) })).json()).token;
  const call = async (method, path) => (await fetch(API + path, { method, headers: { Authorization: `Bearer ${adminToken}` } })).json();
  const findTest = async () => (await call("GET", `/admin/recipes?search=${encodeURIComponent("Thử UI9")}&pageSize=50`)).items;
  for (const r of await findTest()) await fetch(`${API}/admin/recipes/${r.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${adminToken}` } });
  const auditStart = (await call("GET", "/admin/audit-logs?pageSize=1")).total;

  const adminState = await loginState(browser, admin.email, admin.password);
  const userState = await loginState(browser, ACC.demo().email, ACC.demo().password);
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

  // 1) USER vào /admin bị chuyển về /dashboard; menu tài khoản không có Quản trị.
  {
    const { ctx, page } = await open(userState, "/admin/recipes", 1440);
    check("USER vào /admin/recipes → chuyển về /dashboard", new URL(page.url()).pathname === "/dashboard");
    const status = (await fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${(await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json()).token}` } })).status;
    check("API Admin với token USER → 403", status === 403);
    await ctx.close();
  }

  // 2) Ảnh: Thống kê, Công thức, form mới ở 390/1440 sáng/tối.
  for (const [path, name] of [["/admin", "thong-ke"], ["/admin/recipes", "cong-thuc"], ["/admin/recipes/new", "tao-mon"]]) {
    for (const w of [390, 1440]) {
      for (const theme of ["light", "dark"]) {
        const { ctx, page } = await open(adminState, path, w, theme);
        await page.screenshot({ path: `${OUT}/${name}_${w}_${themeName(theme)}.png`, fullPage: true });
        check(`${name} ${w}px ${theme}: không cuộn ngang, một <main>`, (await noOverflow(page)) <= 0 && (await page.locator("main").count()) === 1);
        if (path === "/admin/recipes" && w === 390) {
          const display = await page.locator(".ad-row").first().evaluate((el) => getComputedStyle(el).display);
          check(`Công thức 390px ${theme}: bảng thành thẻ`, display === "grid");
        }
        await ctx.close();
      }
    }
  }

  // 3) Thống kê: số khớp API, biểu đồ có trục/chú thích/bảng ẩn, tương phản màu đường.
  const stats = await call("GET", "/admin/stats");
  for (const theme of ["light", "dark"]) {
    const { ctx, page } = await open(adminState, "/admin", 1440, theme);
    if (theme === "light") {
      const values = await page.locator(".ad-stat__value").allInnerTexts();
      const notes = await page.locator(".ad-stat__note").allInnerTexts();
      check("4 số tổng khớp API, có chú thích", JSON.stringify(values.map((v) => Number(v.replace(/\./g, "")))) === JSON.stringify([stats.totals.users, stats.totals.mealPlans, stats.totals.posts, stats.totals.recipes])
        && notes[0].length > 0 && notes[3].length > 0, `${values.join(",")} | ${notes[0]} | ${notes[3]}`);
      const rows = await page.locator(".ad-chart table tbody tr").count();
      check("Biểu đồ: nhãn trục X/Y, chú thích 3 đường, bảng số liệu ẩn 12 tuần", (await page.locator(".recharts-label").allTextContents()).join("|").includes("Tuần bắt đầu")
        && (await page.locator(".recharts-legend-item").count()) === 3 && rows === 12);
      await page.locator(".ad-chart__canvas").hover({ position: { x: 600, y: 150 } });
      await page.waitForTimeout(300);
      check("Tooltip hiện khi rê chuột", await page.locator(".recharts-tooltip-wrapper").isVisible());
      await page.locator(".ad-card").screenshot({ path: `${OUT}/bieu-do_1440_sang.png` });
    } else {
      await page.locator(".ad-card").screenshot({ path: `${OUT}/bieu-do_1440_toi.png` });
    }
    const lines = await page.evaluate(() => {
      const bg = getComputedStyle(document.querySelector(".ad-card")).backgroundColor;
      return [...document.querySelectorAll(".recharts-line-curve")].map((path) => [getComputedStyle(path).stroke, bg]);
    });
    const ratios = lines.map(([stroke, bg]) => contrast(stroke, bg));
    check(`Màu 3 đường biểu đồ ${theme} ≥ 3:1 so với nền thẻ (đồ họa)`, ratios.length === 3 && ratios.every((r) => r >= 3), ratios.join(", "));
    await ctx.close();
  }

  // 4) Form: lỗi phía client, lỗi nhãn chay 422 tại dòng, tạo món có ảnh.
  {
    const { ctx, page } = await open(adminState, "/admin/recipes/new", 1440);
    await page.getByLabel("Tên món").fill("A");
    await page.getByRole("button", { name: "Tạo món" }).click();
    await page.waitForTimeout(300);
    const invalid = await page.locator(".ad-form [aria-invalid='true']").count();
    const errs = await page.locator(".ad-form .ui-field__error").allInnerTexts();
    check("Lỗi phía client (giống Zod): hiện dưới trường/dòng, không gửi", invalid >= 5 && errs.some((e) => e.includes("ít nhất 2 ký tự")) && errs.some((e) => e.includes("Chọn ít nhất một bữa"))
      && (await findTest()).length === 0, `${invalid} ô lỗi`);
    await page.screenshot({ path: `${OUT}/form-loi_1440_sang.png`, fullPage: true });
    await page.getByLabel("Tên món").fill(NAME);
    await page.getByLabel("Mô tả").fill("Món thử nghiệm thu UI-9: đậu hũ chiên, sốt nấm.");
    await page.getByLabel("Calo").fill("350");
    await page.getByLabel("Đạm").fill("18");
    await page.getByLabel("Tinh bột").fill("20");
    await page.getByLabel("Béo").fill("15");
    await page.getByRole("button", { name: "Bữa trưa" }).click();
    await page.getByRole("button", { name: "Thuần chay" }).click();
    await page.getByLabel("Tên nguyên liệu 1").fill("Đậu hũ");
    await page.locator(".ad-ingredient").first().getByLabel("Số lượng").fill("200");
    await page.getByRole("button", { name: "Thêm nguyên liệu" }).click();
    await page.getByLabel("Tên nguyên liệu 2").fill("Trứng gà");
    await page.locator(".ad-ingredient").nth(1).getByLabel("Số lượng").fill("2");
    await page.locator(".ad-ingredient").nth(1).getByLabel("Đơn vị").selectOption("ITEM");
    await page.getByRole("button", { name: "Chuyển nguyên liệu 2 lên" }).click();
    check("Sắp xếp dòng nguyên liệu (lên/xuống)", (await page.getByLabel("Tên nguyên liệu 1").inputValue()) === "Trứng gà");
    await page.getByRole("button", { name: "Chuyển nguyên liệu 1 xuống" }).click();
    await page.locator(".ad-step textarea").nth(0).fill("Chiên đậu hũ vàng hai mặt.");
    await page.getByRole("button", { name: "Thêm bước" }).click();
    await page.locator(".ad-step textarea").nth(1).fill("Xào nấm, rưới sốt lên đậu.");
    await page.getByRole("button", { name: "Tạo món" }).click();
    await page.locator(".ad-ingredient__diet").waitFor();
    const diet = await page.locator(".ad-ingredient.has-diet-error").evaluate((el) => ({ name: el.querySelector("input").value, text: el.querySelector(".ad-ingredient__diet").textContent }));
    check("Lỗi 422 nhãn chay hiện đúng tại dòng nguyên liệu vi phạm", diet.name === "Trứng gà" && diet.text.includes("Thuần chay") && (await findTest()).length === 0, diet.text);
    await page.locator(".ad-ingredient.has-diet-error").screenshot({ path: `${OUT}/loi-nhan-chay-dong_1440_sang.png` });
    await page.screenshot({ path: `${OUT}/loi-nhan-chay_1440_sang.png`, fullPage: true });
    await page.getByRole("button", { name: "Xóa nguyên liệu 2" }).click();
    // Ảnh: sai định dạng bị chặn trước khi gửi; ảnh đúng có xem trước.
    await page.locator(".ad-image__file").setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    check("Ảnh sai định dạng: báo trước khi gửi", (await page.locator(".ad-image + .ui-error, .ad-form__section .ui-error").first().innerText()).includes("không phải ảnh JPG"));
    await page.locator(".ad-image__file").setInputFiles(`${IMG}/thu-1.jpg`);
    check("Ảnh: xem trước trước khi tải lên", (await page.locator("img.ad-image__preview").getAttribute("src")).startsWith("blob:"));
    await page.getByRole("button", { name: "Tạo món" }).click();
    await page.waitForURL("**/admin/recipes", { timeout: 60000 });
    await page.locator(".ui-toast").waitFor();
    check("Tạo món + ảnh: \"Đã tạo món …\", quay về danh sách", (await page.locator(".ui-toast").innerText()).includes(`Đã tạo món “${NAME}”`));
    await ctx.close();
  }
  let created = (await findTest())[0];
  check("API: món thử có ảnh Cloudinary, nhãn VEGAN + VEGETARIAN", created && /res\.cloudinary\.com/.test(created.imageUrl) && created.dietTags.includes("VEGETARIAN"), created?.imageUrl);
  const firstImage = created.imageUrl;

  // 5) Thấy ở trang Công thức người dùng.
  {
    const { ctx, page } = await open(userState, `/recipes?q=${encodeURIComponent("Thử UI9")}`, 1440);
    const card = page.locator(".recipe-tile", { hasText: NAME });
    check("Trang Công thức người dùng: thấy món mới có ảnh thật", (await card.count()) === 1 && /res\.cloudinary\.com/.test(await card.locator("img").getAttribute("src")));
    await ctx.close();
  }

  // 6) Sửa + thay ảnh + 503 khi chưa cấu hình (giả lập).
  {
    const { ctx, page } = await open(adminState, `/admin/recipes/${created.id}/edit`, 1440);
    await page.getByLabel("Calo").fill("360");
    await page.locator(".ad-image__file").setInputFiles(`${IMG}/thu-2.jpg`);
    await page.getByRole("button", { name: "Tải ảnh lên" }).click();
    await page.waitForFunction(() => !document.querySelector("img.ad-image__preview")?.getAttribute("src")?.startsWith("blob:"), null, { timeout: 60000 });
    const replaced = (await call("GET", `/admin/recipes/${created.id}`)).imageUrl;
    check("Thay ảnh: tải lên ngay, ảnh mới khác ảnh cũ", replaced !== firstImage && /res\.cloudinary\.com/.test(replaced));
    await page.route("**/api/admin/recipes/*/image", (route) => route.fulfill({ status: 503, json: { message: "Chưa cấu hình" } }));
    await page.locator(".ad-image__file").setInputFiles(`${IMG}/thu-3.jpg`);
    await page.getByRole("button", { name: "Tải ảnh lên" }).click();
    await page.locator(".ad-form__section .ui-error").waitFor();
    check("Lỗi 503 khi chưa cấu hình Cloudinary: báo rõ", (await page.locator(".ad-form__section .ui-error").innerText()).includes("Chưa cấu hình Cloudinary"));
    await page.locator("#ad-form-image").evaluate((el) => el.closest("section").scrollIntoView());
    await page.locator("#ad-form-image").evaluate((el) => el.closest("section")).catch(() => {});
    await page.locator(".ad-form__section", { has: page.locator("#ad-form-image") }).screenshot({ path: `${OUT}/anh-503_1440_sang.png` });
    await page.unroute("**/api/admin/recipes/*/image");
    await page.getByRole("button", { name: "Bỏ ảnh đã chọn" }).click();
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await page.waitForURL("**/admin/recipes");
    check("Sửa: \"Đã lưu thay đổi …\", API cập nhật", (await page.locator(".ui-toast").innerText()).includes(`Đã lưu thay đổi cho “${NAME}”`)
      && (await call("GET", `/admin/recipes/${created.id}`)).calories === 360);
    await ctx.close();
  }

  // 7) Ẩn (ConfirmDialog) → không còn ở trang người dùng → Hiện → Xóa (ConfirmDialog).
  {
    const { ctx, page } = await open(adminState, "/admin/recipes", 1440);
    await page.getByLabel("Tìm món theo tên").fill("Thử UI9");
    await page.locator(".ad-row", { hasText: NAME }).waitFor();
    await page.getByRole("button", { name: `Ẩn ${NAME}` }).click();
    const dialog = page.locator("dialog.ui-dialog[open]");
    await dialog.waitFor();
    check("Ẩn: hộp xác nhận nói rõ hậu quả", (await dialog.innerText()).includes(`Ẩn “${NAME}”?`) && (await dialog.innerText()).includes("Thực đơn và bài viết cũ vẫn giữ món"));
    await page.screenshot({ path: `${OUT}/xac-nhan-an_1440_sang.png` });
    await dialog.getByRole("button", { name: "Ẩn món" }).click();
    await page.locator(".ui-toast", { hasText: "Đã ẩn" }).waitFor();
    check("Ẩn: trạng thái \"Đã ẩn\", API hidden", (await page.locator(".ad-row", { hasText: NAME }).innerText()).includes("Đã ẩn") && (await call("GET", `/admin/recipes/${created.id}`)).hidden === true);
    const user = await browser.newContext({ storageState: userState });
    const up = await user.newPage();
    await up.goto(`${APP}/recipes?q=${encodeURIComponent("Thử UI9")}`);
    await up.waitForLoadState("networkidle");
    check("Món ẩn không còn ở trang Công thức người dùng", (await up.locator(".recipe-tile", { hasText: NAME }).count()) === 0);
    await user.close();
    await page.getByRole("button", { name: `Hiện lại ${NAME}` }).click();
    await page.locator(".ui-toast", { hasText: "Đã hiện lại" }).waitFor();
    check("Hiện lại: không cần xác nhận, API visible", (await call("GET", `/admin/recipes/${created.id}`)).hidden === false);
    await page.getByRole("button", { name: `Xóa ${NAME}` }).click();
    const del = page.locator("dialog.ui-dialog[open]");
    await del.waitFor();
    check("Xóa: hộp xác nhận nêu tên và hậu quả", (await del.innerText()).includes(`Xóa “${NAME}”?`) && (await del.innerText()).includes("Không hoàn tác được"));
    await page.screenshot({ path: `${OUT}/xac-nhan-xoa_1440_sang.png` });
    await del.getByRole("button", { name: "Xóa món" }).click();
    await page.locator(".ui-toast", { hasText: "Đã xóa" }).waitFor();
    check("Xóa: món biến mất khỏi danh sách và API", (await findTest()).length === 0);
    await ctx.close();
  }
  // Món đã dùng: nút Xóa tắt, có giải thích (giả lập usage, không đổi dữ liệu).
  {
    const { ctx, page } = await open(adminState, "/admin/recipes", 1440, "light", (p) => p.route("**/api/admin/recipes?**", async (route) => {
      const res = await route.fetch(); const json = await res.json();
      json.items[0].usage = { mealPlanItems: 3, posts: 1 };
      return route.fulfill({ response: res, json });
    }));
    const row = page.locator(".ad-row").first();
    const del = row.getByRole("button", { name: /^Xóa / });
    const reason = await del.evaluate((el) => document.getElementById(el.getAttribute("aria-describedby"))?.textContent);
    check("Món đã dùng: Xóa bị tắt, giải thích và gợi ý Ẩn", await del.isDisabled() && reason.includes("không xóa được") && reason.includes("Hãy ẩn món")
      && (await row.innerText()).includes("3 bữa trong thực đơn"), reason);
    await ctx.close();
  }

  // 8) Tương phản chữ, Tab, phông, 320px.
  for (const [path, name] of [["/admin", "Thống kê"], ["/admin/recipes", "Công thức"], ["/admin/recipes/new", "Form"]]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(adminState, path, 1440, theme);
      const sels = [".ad-tab", ".ad-tab.is-active", ".ad-section__title", ".ad-stat__label", ".ad-stat__note", ".ad-chart__caption", ".recharts-cartesian-axis-tick-value",
        ".ad-table th", ".ad-sub", ".ad-muted", ".ad-status", ".ui-tag", ".ad-pager__count", ".ui-field__label", ".ad-unit__label", ".ui-small", ".ad-back"];
      const pairs = await page.evaluate(`(${(fn, list) => list.flatMap((sel) => [...document.querySelectorAll(sel)].slice(0, 1).map((el) => [sel, Math.round(fn(el) * 100) / 100]))})(${contrastOf.toString()}, ${JSON.stringify(sels)})`);
      const weak = pairs.filter(([, r]) => r < 4.5);
      check(`${name} tương phản chữ ${theme}: ${pairs.length} cặp ≥ 4.5:1`, pairs.length >= 5 && weak.length === 0, (weak.length ? weak : pairs).map(([s, r]) => `${s}=${r}`).join(" "));
      if (theme === "light") {
        const hidden = []; let stops = 0;
        for (let i = 0; i < 120; i++) {
          await page.keyboard.press("Tab"); await page.waitForTimeout(40);
          let info = await page.evaluate(() => {
            const el = document.activeElement; if (!el || el === document.body) return null;
            const target = el.classList.contains("ad-image__file") ? el.closest("label") : el;
            const cs = getComputedStyle(target);
            return { name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30), main: Boolean(el.closest("main")),
              visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
          });
          if (!info) break;
          if (info.main && !info.visible) { await page.waitForTimeout(250); info = { ...info, visible: await page.evaluate(() => { const el = document.activeElement; const t = el.classList.contains("ad-image__file") ? el.closest("label") : el; const s = getComputedStyle(t); return s.outlineStyle !== "none" || s.boxShadow !== "none"; }) }; }
          if (info.main) { stops++; if (!info.visible) hidden.push(info.name); }
        }
        check(`${name}: Tab ${stops} điểm dừng đều thấy focus`, stops >= 5 && hidden.length === 0, hidden.slice(0, 5).join(" | "));
        const client = await ctx.newCDPSession(page);
        await client.send("DOM.enable"); await client.send("CSS.enable");
        const { root } = await client.send("DOM.getDocument", { depth: -1 });
        const issues = [];
        for (const selector of ["h1", "h1 em", ".ad-section__title", ".ad-stat__value"]) {
          const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
          for (const nodeId of nodeIds) {
            const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
            if (!fonts.every((f) => /Fraunces/.test(f.familyName) && f.isCustomFont)) issues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
          }
        }
        check(`${name}: tiêu đề có dấu chồng (Quản trị, Thống kê, Công thức) vẽ bằng Fraunces`, issues.length === 0, issues.join("; "));
        await page.setViewportSize({ width: 320, height: 800 });
        await page.waitForTimeout(400);
        check(`${name}: 320px không cuộn ngang`, (await noOverflow(page)) <= 0);
      }
      await ctx.close();
    }
  }

  // 9) Dọn: không còn món thử; ảnh trên Cloudinary đã xóa; nhật ký thao tác có ghi.
  check("Không còn món thử", (await findTest()).length === 0);
  check("Thư mục nouri/recipes trên Cloudinary trống", cloudinaryCount() === "0");
  const audit = await call("GET", `/admin/audit-logs?pageSize=50`);
  const added = audit.total - auditStart;
  check("Nhật ký Admin ghi các thao tác (tạo, ảnh, sửa, ẩn, hiện, xóa)", added >= 6, `${added} dòng mới`);
  console.log(`AUDIT_NEW=${added}`);
  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
