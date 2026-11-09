// GĐ3b lượt 7: nghiệm thu giao diện lịch sử kho. node gd3b-l7-check.cjs <thư mục ảnh>. Không reset ở đầu; cuối lượt mới reset (sau khi kiểm dữ liệu demo).
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const [OUT] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const SOURCE = { MANUAL_ADD: "Nhập tay", MANUAL_EDIT: "Sửa tay", MANUAL_DELETE: "Xóa", CONSUMPTION: "Tiêu thụ", PURCHASE: "Mua sắm", RECEIPT_SCAN: "Quét hóa đơn" };
const UNIT = { G: "g", KG: "kg", ML: "ml", L: "l", ITEM: "cái", PACKAGE: "gói" };
const fmt = (q, u) => `${q.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${UNIT[u]}`;
const delta = (t) => (t.delta > 0 ? `+${fmt(t.delta, t.unit)}` : t.delta < 0 ? `−${fmt(-t.delta, t.unit)}` : fmt(0, t.unit));
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
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json();
  const call = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${login.token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return res.status === 204 ? null : res.json();
  };
  const browser = await chromium.launch();
  const errors = [];
  const state = await (async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    await p.addInitScript(([token, user]) => { localStorage.setItem("nouri_token", token); localStorage.setItem("nouri_user", JSON.stringify(user)); }, [login.token, login.user]);
    await p.goto(APP + "/dashboard"); const s = await ctx.storageState(); await ctx.close(); return s;
  })();
  const open = async (path, w, theme = "light", setup, idle = true) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    if (setup) await setup(page);
    await page.goto(APP + path);
    if (idle) await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    if (idle) await page.waitForTimeout(300);
    return { ctx, page };
  };
  const section = (page) => page.locator("section[aria-labelledby=kho-history-title]");
  const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  // 0) Trạng thái trống (chưa có lịch sử: demo vừa reset ở cuối lượt trước).
  const initial = await call("GET", "/pantry/transactions?page=1&pageSize=50");
  check("Đầu lượt: demo chưa có dòng lịch sử nào (demo đã reset cuối lượt trước)", initial.total === 0, `total=${initial.total}`);
  {
    const { ctx, page } = await open("/pantry", 1440);
    await section(page).scrollIntoViewIfNeeded();
    check("Lịch sử trống: câu giải thích", (await section(page).innerText()).includes("Chưa có thay đổi nào trong kho"));
    await section(page).screenshot({ path: `${OUT}/lich-su-trong_1440_sang.png` });
    await ctx.close();
  }

  // 1) Thêm + sửa bằng giao diện.
  {
    const { ctx, page } = await open("/pantry", 1440);
    await page.getByRole("button", { name: "Thêm thực phẩm" }).first().click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel("Tên thực phẩm").fill("Cà chua");
    await dialog.getByLabel("Số lượng", { exact: true }).fill("500");
    await dialog.getByLabel("Đơn vị").selectOption("G");
    await dialog.getByRole("button", { name: "Lưu vào kho" }).click();
    await dialog.waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("searchbox").fill("Cà chua");
    await page.getByRole("button", { name: "Sửa Cà chua" }).first().click();
    await dialog.getByLabel("Số lượng", { exact: true }).fill("300");
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    await dialog.waitFor({ state: "detached" });
    await ctx.close();
  }
  const tomato = (await call("GET", "/pantry")).find((p) => p.name === "Cà chua");

  // 2) Ăn (trừ kho) và mua (cộng kho) qua API, rồi hoàn tác cả hai.
  const d = new Date();
  const plan = await call("POST", "/meal-plans/generate", { startDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` });
  const pantryNames = new Set((await call("GET", "/pantry")).map((p) => p.name.toLowerCase()));
  let meal = null, preview = null;
  for (const day of plan.days) for (const item of day.items) {
    if (meal) break;
    const p = await call("GET", `/meal-plans/items/${item.id}/consumption-preview`);
    if (p.lines.some((l) => l.defaultQuantity > 0)) { meal = item; preview = p; }
  }
  const lines = preview.lines.filter((l) => l.defaultQuantity > 0).map((l) => ({ ingredientId: l.ingredientId, quantity: l.defaultQuantity, unit: l.required.unit }));
  const eaten = await call("PATCH", `/meal-plans/items/${meal.id}`, { completed: true, consumption: { mode: "deduct", lines } });
  const deducted = eaten.consumption.lines.flatMap((l) => l.deductions);
  const shop = plan.shoppingItems.find((s) => pantryNames.has(s.name.toLowerCase())) ?? plan.shoppingItems[0];
  const bought = await call("PATCH", `/meal-plans/shopping/${shop.id}`, { purchased: true });
  await call("PATCH", `/meal-plans/items/${meal.id}`, { completed: false });
  await call("PATCH", `/meal-plans/shopping/${shop.id}`, { purchased: false });
  check("Chuẩn bị: ăn trừ kho và mua cộng kho đều có thay đổi", deducted.length > 0 && bought.pantry, `${meal.recipe.name}: trừ ${deducted.length} dòng; mua ${shop.name}`);

  // 3) Xóa Cà chua bằng giao diện (hộp xác nhận).
  {
    const { ctx, page } = await open("/pantry", 1440);
    await page.getByRole("searchbox").fill("Cà chua");
    await page.getByRole("button", { name: "Xóa Cà chua" }).first().click();
    await page.locator("dialog[open]").getByRole("button", { name: "Xóa thực phẩm" }).click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);
    await ctx.close();
  }

  const all = await call("GET", "/pantry/transactions?page=1&pageSize=50");
  const expectCount = 2 /* thêm, sửa */ + deducted.length * 2 /* trừ + hoàn lại */ + 2 /* mua + hoàn lại */ + 1 /* xóa */;
  check("API: số dòng lịch sử đúng với các thao tác", all.total === expectCount, `${all.total} dòng (mong đợi ${expectCount})`);

  // 4) Trang Kho: phần Lịch sử khớp API từng dòng (trang 1), lọc, phân trang, liên kết.
  {
    const { ctx, page } = await open("/pantry", 1440);
    const rows = section(page).locator(".kho-history__row");
    await rows.first().waitFor();
    const first = all.items.slice(0, 20);
    const texts = await rows.allInnerTexts();
    const mismatch = first.map((t, i) => {
      const text = texts[i] ?? "";
      const want = [t.itemName, delta(t), SOURCE[t.source]];
      if (t.reversalOfId) want.push("Hoàn lại");
      else if (t.reversedAt) want.push("Đã hoàn lại");
      if (t.mealPlanItem) want.push(t.mealPlanItem.recipe.name);
      if (t.shoppingItem) want.push("Danh sách đi chợ của thực đơn");
      return want.filter((w) => !text.includes(w)).map((w) => `#${i + 1} thiếu "${w}"`);
    }).flat();
    check("Mỗi dòng: thực phẩm, thay đổi ±, nguồn tiếng Việt, Hoàn lại/Đã hoàn lại, liên kết bữa/thực đơn (trang 1)", texts.length === first.length && !mismatch.length, mismatch.slice(0, 4).join("; ") || `${texts.length} dòng`);
    const vn = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(all.items[0].createdAt));
    check("Thời gian theo giờ Việt Nam", texts[0].includes(vn), vn);
    const sources = {};
    for (const t of all.items) sources[t.source] = (sources[t.source] ?? 0) + 1;
    check("Có đủ 5 nguồn: Nhập tay, Sửa tay, Tiêu thụ, Mua sắm, Xóa", ["MANUAL_ADD", "MANUAL_EDIT", "CONSUMPTION", "PURCHASE", "MANUAL_DELETE"].every((s) => sources[s]), JSON.stringify(sources));

    // Phân trang (nếu > 20 dòng).
    if (all.total > 20) {
      await section(page).getByRole("button", { name: "Trang sau" }).click();
      await section(page).getByText(`Hiển thị 21–${Math.min(40, all.total)} trong ${all.total} thay đổi`).waitFor();
      const second = await section(page).locator(".kho-history__row .kho-name").allInnerTexts();
      check("Phân trang: trang 2 đúng các dòng tiếp theo", JSON.stringify(second) === JSON.stringify(all.items.slice(20, 40).map((t) => t.itemName)));
      await section(page).getByRole("button", { name: "Trang trước" }).click();
    } else check("Phân trang: một trang thì không có nút trang", (await section(page).getByRole("button", { name: "Trang sau" }).count()) === 0);

    // Lọc theo nguồn.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("source=CONSUMPTION")),
      section(page).getByRole("button", { name: "Tiêu thụ" }).click(),
    ]);
    await page.waitForTimeout(300);
    const consumed = await section(page).locator(".kho-history__row").allInnerTexts();
    check("Lọc \"Tiêu thụ\": chỉ dòng Tiêu thụ, đúng số dòng", consumed.length === sources.CONSUMPTION && consumed.every((t) => t.includes("Tiêu thụ"))
      && (await section(page).getByRole("button", { name: "Tiêu thụ" }).getAttribute("aria-pressed")) === "true", `${consumed.length} dòng`);
    await section(page).getByRole("button", { name: "Quét hóa đơn" }).click();
    await section(page).getByText("Chưa có thay đổi nào từ nguồn “Quét hóa đơn”.").waitFor();
    check("Lọc nguồn không có dòng: trạng thái trống + \"Xem tất cả\"", await section(page).getByRole("button", { name: "Xem tất cả" }).isVisible());
    await section(page).getByRole("button", { name: "Xem tất cả" }).click();
    await section(page).locator(".kho-history__row").nth(all.total - 1).waitFor();
    await page.waitForTimeout(500);

    // Tab tới liên kết bữa ăn: viền focus; bấm → đúng thực đơn.
    const link = section(page).locator(".kho-history__link").first();
    await link.focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(500);
    const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return document.activeElement.classList.contains("kho-history__link") && s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0; });
    const focused = await page.evaluate(() => { const a = document.activeElement; const st = getComputedStyle(a); return `${a.tagName}.${a.className} ${st.outlineStyle} ${st.outlineWidth}`; });
    check("Liên kết bữa/thực đơn nhận focus bàn phím, có viền focus", outline, focused);
    const pairs = await page.evaluate(`(${(fn) => [".kho-history .ui-tag", ".kho-history__reversal", ".kho-history__delta.is-minus", ".kho-history__delta:not(.is-minus)", ".kho-history__link", ".kho-history .kho-sub"]
      .map((sel) => [sel, Math.round(fn(document.querySelector(sel)) * 100) / 100])})(${contrastOf.toString()})`);
    check("Tương phản (sáng) ≥ 4.5:1: nhãn nguồn, Hoàn lại, thay đổi, liên kết, chữ phụ", pairs.every(([, r]) => r >= 4.5), pairs.map(([s, r]) => `${s}=${r}`).join(" "));
    await link.click();
    await page.waitForURL(/\/meal-plans\//);
    check("Bấm liên kết → mở đúng thực đơn", page.url().endsWith(`/meal-plans/${plan.id}`));
    await ctx.close();
  }

  // 5) Hộp thoại Sửa → "Xem lịch sử": chỉ các dòng của thực phẩm đó.
  const target = deducted[0];
  const itemHistory = await call("GET", `/pantry/transactions?pantryItemId=${target.pantryItemId}&page=1&pageSize=10`);
  {
    const { ctx, page } = await open("/pantry", 1440);
    await page.getByRole("searchbox").fill(target.name);
    await page.getByRole("button", { name: `Sửa ${target.name}` }).first().click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByText("Xem lịch sử").click();
    await dialog.locator(".kho-history__row").first().waitFor();
    const rows = await dialog.locator(".kho-history__row").allInnerTexts();
    check("\"Xem lịch sử\" lọc đúng thực phẩm (trừ khi ăn, hoàn lại)", rows.length === itemHistory.total && rows.some((r) => r.includes("Tiêu thụ") && r.includes("−"))
      && rows.some((r) => r.includes("Hoàn lại")), `${target.name}: ${rows.map((r) => r.replace(/\s+/g, " ")).join(" | ")}`);
    await dialog.locator(".kho-item-history").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/sua-xem-lich-su_1440_sang.png` });
    await ctx.close();
  }

  // 6) Ảnh 390/1440 sáng/tối: phần Lịch sử và hộp thoại có lịch sử.
  for (const w of [390, 1440]) for (const theme of ["light", "dark"]) {
    const t = theme === "light" ? "sang" : "toi";
    const { ctx, page } = await open("/pantry", w, theme);
    await section(page).locator(".kho-history__row").first().waitFor();
    await section(page).screenshot({ path: `${OUT}/lich-su_${w}_${t}.png` });
    check(`Kho ${w}px ${theme}: không cuộn ngang`, (await noOverflow(page)) <= 0);
    if (theme === "dark") {
      const pairs = await page.evaluate(`(${(fn) => [".kho-history .ui-tag", ".kho-history__reversal", ".kho-history__delta.is-minus", ".kho-history__link", ".kho-history .kho-sub"]
        .map((sel) => [sel, Math.round(fn(document.querySelector(sel)) * 100) / 100])})(${contrastOf.toString()})`);
      check(`Tương phản (tối, ${w}px) ≥ 4.5:1`, pairs.every(([, r]) => r >= 4.5), pairs.map(([s, r]) => `${s}=${r}`).join(" "));
    }
    await page.getByRole("searchbox").fill(target.name);
    await page.getByRole("button", { name: `Sửa ${target.name}` }).first().click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByText("Xem lịch sử").click();
    await dialog.locator(".kho-history__row").first().waitFor();
    await dialog.locator(".kho-item-history").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/sua-xem-lich-su_${w}_${t}.png` });
    check(`Hộp thoại ${w}px ${theme}: lịch sử không tràn ngang`, await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await ctx.close();
  }

  // 7) Đang tải, lỗi (giả lập phản hồi API, không đổi dữ liệu), 320px.
  {
    const { ctx, page } = await open("/pantry", 1440, "light", (p) => p.route("**/api/pantry/transactions**", async (r) => { await new Promise((x) => setTimeout(x, 2500)); await r.continue(); }), false);
    await section(page).locator(".ui-loading").waitFor({ timeout: 2000 }).catch(() => {});
    check("Đang tải: khung chờ trong phần Lịch sử", (await section(page).locator(".ui-loading").innerText()).includes("Đang tải lịch sử kho"));
    await section(page).screenshot({ path: `${OUT}/lich-su-dang-tai_1440_sang.png` });
    await ctx.close();
  }
  {
    let fail = true;
    const { ctx, page } = await open("/pantry", 1440, "light", (p) => p.route("**/api/pantry/transactions**", (r) => (fail ? r.fulfill({ status: 500, body: "{}" }) : r.continue())));
    await section(page).getByText("Chưa tải được lịch sử kho.").waitFor({ timeout: 15000 });
    await section(page).screenshot({ path: `${OUT}/lich-su-loi_1440_sang.png` });
    fail = false;
    await section(page).getByRole("button", { name: /Thử lại/ }).click();
    await section(page).locator(".kho-history__row").first().waitFor();
    check("Lỗi: báo lỗi + Thử lại tải được", true);
    await ctx.close();
  }
  {
    const { ctx, page } = await open("/pantry", 320);
    await section(page).locator(".kho-history__row").first().waitFor();
    check("320px: không cuộn ngang", (await noOverflow(page)) <= 0);
    await ctx.close();
  }

  check("Không có lỗi JavaScript", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} đạt`);
  console.log(`PLAN=${plan.id}`);
})().catch((e) => { console.error(e); process.exit(1); });
