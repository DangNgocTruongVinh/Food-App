// GĐ3b lượt 5: nghiệm thu nhóm thực phẩm chung (danh sách đi chợ theo nhóm backend) và "Đã dùng hết" ở Kho.
// node gd3b-l5-check.cjs <thư mục ảnh>. Đầu và cuối chạy demo:reset.
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const [OUT] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const CATEGORIES = ["Rau củ", "Thịt & cá", "Trứng & sữa", "Đậu & hạt", "Ngũ cốc", "Trái cây", "Gia vị", "Khác"];
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const sql = (q) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { cwd: ACC.ROOT, input: q }).toString().trim();
const demoReset = () => execFileSync("docker", ["compose", "exec", "-T", "backend", "npm", "run", "-s", "demo:reset", "--", "--yes"], { cwd: ACC.ROOT }).toString().trim();
const contrastOf = (el) => {
  const parse = (c) => c.match(/[\d.]+/g).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fg = parse(getComputedStyle(el).color);
  let node = el, bg = null;
  while (node && node.nodeType === 1) { const c = parse(getComputedStyle(node).backgroundColor); if (c.length < 4 || c[3] > 0.9) { bg = c; break; } node = node.parentElement; }
  const [a, b] = [lum(fg), lum(bg || [255, 255, 255])].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

(async () => {
  console.log(demoReset());
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json();
  const call = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${login.token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return res.status === 204 ? null : res.json();
  };
  // Hai thực phẩm về 0: Đậu hũ (hạn 1 ngày → nếu còn số lượng sẽ ở "Cần dùng sớm") và Hành tím.
  const pantry = await call("GET", "/pantry");
  const tofu = pantry.find((i) => i.name === "Đậu hũ"), shallot = pantry.find((i) => i.name === "Hành tím");
  await call("PUT", `/pantry/${tofu.id}`, { quantity: 0 });
  await call("PUT", `/pantry/${shallot.id}`, { quantity: 0 });
  const d = new Date();
  const plan = await call("POST", "/meal-plans/generate", { startDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` });
  check("Tạo thực đơn: mọi dòng đi chợ có nhóm thuộc bộ 8 nhóm (lưu trong DB)", plan.shoppingItems.length > 0 && plan.shoppingItems.every((s) => CATEGORIES.includes(s.category))
    && sql(`SELECT count(*) FROM "ShoppingItem" WHERE "mealPlanId"='${plan.id}' AND category IS NULL;`) === "0", `${plan.shoppingItems.length} dòng`);
  // Dòng cũ chưa có nhóm: tính khi đọc.
  const old = plan.shoppingItems.find((s) => /^Đậu hũ$|^Gạo/.test(s.name)) ?? plan.shoppingItems[0];
  sql(`UPDATE "ShoppingItem" SET category = NULL WHERE id='${old.id}';`);
  const reread = (await call("GET", `/meal-plans/${plan.id}`)).shoppingItems.find((s) => s.id === old.id);
  check("Dòng đi chợ cũ (category NULL) → API tính nhóm khi đọc, không đổi DB", reread.category === old.category
    && sql(`SELECT count(*) FROM "ShoppingItem" WHERE id='${old.id}' AND category IS NULL;`) === "1", `${old.name} → ${reread.category}`);

  const browser = await chromium.launch();
  const errors = [];
  const state = await (async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    await p.addInitScript(([token, user]) => { localStorage.setItem("nouri_token", token); localStorage.setItem("nouri_user", JSON.stringify(user)); }, [login.token, login.user]);
    await p.goto(APP + "/dashboard"); const s = await ctx.storageState(); await ctx.close(); return s;
  })();
  const open = async (path, w, theme = "light") => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(APP + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    return { ctx, page };
  };
  const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  // 1) Kho: ảnh 390/1440 sáng/tối.
  for (const w of [390, 1440]) for (const theme of ["light", "dark"]) {
    const { ctx, page } = await open("/pantry", w, theme);
    await page.screenshot({ path: `${OUT}/kho-da-dung-het_${w}_${theme === "light" ? "sang" : "toi"}.png`, fullPage: true });
    check(`Kho ${w}px ${theme}: không cuộn ngang`, (await noOverflow(page)) <= 0);
    if (w === 1440) {
      const pairs = await page.evaluate(`(${(fn) => [".kho-status--depleted", ".kho-stat__note"].map((sel) => [sel, Math.round(fn(document.querySelector(sel)) * 100) / 100])})(${contrastOf.toString()})`);
      check(`Tương phản nhãn "Đã dùng hết" và chú thích ô (${theme}) ≥ 4.5:1`, pairs.every(([, r]) => r >= 4.5), pairs.map(([s, r]) => `${s}=${r}`).join(" "));
    }
    await ctx.close();
  }
  {
    const { ctx, page } = await open("/pantry", 1440);
    const stat = await page.locator(".kho-stat").first().innerText();
    check("Ô \"Tất cả\" = 6 (không đếm 2 món đã dùng hết), chú thích nêu rõ", stat.includes("6") && stat.includes("Không tính 2 món đã dùng hết"), stat.replace(/\s+/g, " "));
    const rows = await page.locator(".kho-row").allInnerTexts();
    const last = rows.slice(-2).map((r) => r.split("\n")[0]);
    check("Thực phẩm số lượng 0 có nhãn \"Đã dùng hết\" và xếp cuối danh sách", rows.filter((r) => r.includes("Đã dùng hết")).length === 2
      && last.every((n) => ["Đậu hũ", "Hành tím"].some((x) => n.includes(x))), last.join(", "));
    const chips = await page.locator(".kho-chips, .kho-categories").first().innerText().catch(() => "");
    const depletedRow = page.locator(".kho-row", { hasText: "Hành tím" });
    check("Chip \"Tất cả\" đếm cả món đã dùng hết (= số dòng danh sách); hạn của món đã dùng hết không tô cảnh báo",
      (await page.locator(".kho-pager__count").innerText()).includes("trong 8 thực phẩm") && /Tất cả\s*8/.test(await page.getByRole("button", { name: /^Tất cả/ }).last().innerText())
      && (await depletedRow.locator(".kho-sub--warn").count()) === 0, chips.replace(/\s+/g, " ").slice(0, 80));
    const soon = await page.locator(".kho-soon").innerText();
    check("\"Cần dùng sớm\" bỏ qua Đậu hũ đã dùng hết (dù hạn còn 1 ngày)", !soon.includes("Đậu hũ") && soon.includes("Ức gà"), soon.replace(/\s+/g, " ").slice(0, 90));
    await page.getByLabel("Tình trạng", { exact: true }).selectOption("depleted");
    await page.waitForTimeout(300);
    const filtered = await page.locator(".kho-row").allInnerTexts();
    check("Bộ lọc \"Đã dùng hết\": chỉ 2 món số lượng 0, không ô thống kê nào đang chọn", filtered.length === 2 && filtered.every((r) => r.includes("Đã dùng hết"))
      && (await page.locator('.kho-stat[aria-pressed="true"]').count()) === 0);
    await page.screenshot({ path: `${OUT}/kho-loc-da-dung-het_1440_sang.png`, fullPage: true });
    await page.getByRole("button", { name: "Xóa Hành tím" }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Xóa thực phẩm" }).click();
    await page.locator(".ui-toast", { hasText: "Đã xóa" }).waitFor();
    check("Xóa thực phẩm đã dùng hết như thường (hộp xác nhận, toast)", !(await call("GET", "/pantry")).some((i) => i.id === shallot.id) && (await page.locator(".kho-row").count()) === 1);
    await page.getByLabel("Tình trạng", { exact: true }).selectOption("all");
    await page.locator("main").getByRole("button", { name: "Thêm thực phẩm" }).first().click();
    const options = await page.locator("dialog[open]").getByLabel("Nhóm").locator("option").allTextContents();
    check("Hộp thêm thực phẩm: 8 nhóm chung, có \"Đậu & hạt\", \"Ngũ cốc\"", JSON.stringify(options) === JSON.stringify(CATEGORIES), options.join(", "));
    await page.keyboard.press("Escape");
    await ctx.close();
  }
  {
    const { ctx, page } = await open("/pantry", 320);
    check("Kho 320px: không cuộn ngang", (await noOverflow(page)) <= 0);
    await ctx.close();
  }
  // 2) Thực đơn: danh sách đi chợ theo nhóm backend, đúng thứ tự 8 nhóm.
  for (const [w, theme] of [[1440, "light"], [1440, "dark"], [390, "light"], [390, "dark"]]) {
    const { ctx, page } = await open(`/meal-plans/${plan.id}`, w, theme);
    await page.locator(".td-shopping").scrollIntoViewIfNeeded();
    await page.locator(".td-shopping").screenshot({ path: `${OUT}/di-cho-theo-nhom_${w}_${theme === "light" ? "sang" : "toi"}.png` });
    if (w === 1440 && theme === "light") {
      const groups = await page.locator(".td-shop-group__title").allTextContents();
      const apiGroups = CATEGORIES.filter((c) => plan.shoppingItems.some((s) => s.category === c));
      check("Nhóm đi chợ trên trang = nhóm của API, theo thứ tự 8 nhóm", JSON.stringify(groups) === JSON.stringify(apiGroups), groups.join(", "));
      const tofuGroup = await page.locator(".td-shop-group", { has: page.getByText("Đậu hũ", { exact: false }) }).locator(".td-shop-group__title").allTextContents();
      check("Đậu hũ (nếu cần mua) nằm trong \"Đậu & hạt\"", !plan.shoppingItems.some((s) => s.name === "Đậu hũ") || tofuGroup.includes("Đậu & hạt"), tofuGroup.join(","));
    }
    await ctx.close();
  }
  // 3) Tổng quan: số thực phẩm trong kho không đếm món đã dùng hết.
  {
    const dash = await call("GET", "/dashboard");
    const live = (await call("GET", "/pantry")).filter((i) => i.quantity > 0).length;
    check("Tổng quan: \"Thực phẩm trong kho\" chỉ đếm món còn số lượng; \"Cần dùng sớm\" không có Đậu hũ",
      dash.pantryCount === live && !dash.expiringItems.some((i) => i.name === "Đậu hũ"), `${dash.pantryCount}/${live}`);
  }
  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(demoReset());
  check("demo:reset ở cuối: 0 thực đơn, 8 thực phẩm mẫu", sql(`SELECT count(*) FROM "MealPlan" WHERE "userId"=(SELECT id FROM "User" WHERE email='${ACC.demo().email}');`) === "0"
    && sql(`SELECT count(*) FROM "PantryItem" WHERE "userId"=(SELECT id FROM "User" WHERE email='${ACC.demo().email}') AND quantity > 0;`) === "8");
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); try { console.log(demoReset()); } catch {} process.exit(1); });
