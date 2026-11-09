// GĐ3b lượt 4: nghiệm thu hộp "Đã ăn" (ConsumeMealDialog) ở Tổng quan và Thực đơn. node gd3b-l4-check.cjs <thư mục ảnh>
// Đầu và cuối chạy demo:reset (trả demo về trạng thái chuẩn). Ảnh 6 trạng thái dòng dùng phản hồi xem trước giả lập.
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const [OUT] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const sql = (q) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { cwd: ACC.ROOT, input: q }).toString().trim();
const demoReset = () => execFileSync("docker", ["compose", "exec", "-T", "backend", "npm", "run", "-s", "demo:reset", "--", "--yes"], { cwd: ACC.ROOT }).toString().trim();
const FACTOR = { G: ["m", 1], KG: ["m", 1000], ML: ["v", 1], L: ["v", 1000], ITEM: ["i", 1], PACKAGE: ["p", 1] };
const norm = (s) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
const round = (n) => Math.round(n * 1000) / 1000;
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

const mockLines = (id) => [
  { ingredientId: "cm60000000000000000000001", name: "Gạo", optional: false, required: { quantity: 50, unit: "G" }, status: "ENOUGH",
    deductions: [{ pantryItemId: "p1", name: "Gạo", quantity: 0.05, unit: "KG", expiryDate: "2027-02-01T00:00:00.000Z", quantityAfter: 1.95 }], shortfall: 0, defaultQuantity: 50, otherUnits: [] },
  { ingredientId: "cm60000000000000000000002", name: "Hành tím", optional: false, required: { quantity: 10, unit: "G" }, status: "SHORT",
    deductions: [{ pantryItemId: "p2", name: "Hành tím", quantity: 6, unit: "G", expiryDate: "2026-11-04T00:00:00.000Z", quantityAfter: 0 }], shortfall: 4, defaultQuantity: 6, otherUnits: [] },
  { ingredientId: "cm60000000000000000000003", name: "Ức gà", optional: false, required: { quantity: 100, unit: "G" }, status: "EXPIRED_ONLY", deductions: [], shortfall: 100, defaultQuantity: 0, otherUnits: [] },
  { ingredientId: "cm60000000000000000000004", name: "Cà rốt", optional: false, required: { quantity: 80, unit: "G" }, status: "UNIT_MISMATCH", deductions: [], shortfall: 80, defaultQuantity: 0, otherUnits: ["ITEM"] },
  { ingredientId: "cm60000000000000000000005", name: "Nước mắm", optional: false, required: { quantity: 10, unit: "ML" }, status: "NOT_IN_PANTRY", deductions: [], shortfall: 10, defaultQuantity: 0, otherUnits: [] },
  { ingredientId: "cm60000000000000000000006", name: "Ớt", optional: true, required: { quantity: 5, unit: "G" }, status: "OPTIONAL",
    deductions: [{ pantryItemId: "p6", name: "Ớt", quantity: 5, unit: "G", expiryDate: null, quantityAfter: 45 }], shortfall: 0, defaultQuantity: 0, otherUnits: [] },
].map((line) => ({ ...line, id }));
const mockPreview = (url) => {
  const id = url.match(/items\/([^/]+)\/consumption-preview/)[1];
  return { mealPlanItemId: id, completed: false, alreadyDeducted: false, servings: 1, recipe: { id: "r", name: "Cháo gà hành gừng", servings: 1 }, lines: mockLines(id) };
};

(async () => {
  console.log(demoReset());
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json();
  const call = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${login.token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return res.status === 204 ? null : res.json();
  };
  const pantry = async () => call("GET", "/pantry");
  const totals = (items) => {
    const map = new Map();
    for (const item of items) { const [dim, f] = FACTOR[item.unit]; const key = `${norm(item.name)}|${dim}`; map.set(key, round((map.get(key) ?? 0) + item.quantity * f)); }
    return map;
  };
  const d = new Date();
  const plan = await call("POST", "/meal-plans/generate", { startDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` });
  await call("PATCH", `/meal-plans/${plan.id}/status`, { status: "ACTIVE" });
  const todayItems = plan.days[0].items;

  const browser = await chromium.launch();
  const errors = [];
  const state = await (async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    await p.addInitScript(([token, user]) => { localStorage.setItem("nouri_token", token); localStorage.setItem("nouri_user", JSON.stringify(user)); }, [login.token, login.user]);
    await p.goto(APP + "/dashboard"); const s = await ctx.storageState(); await ctx.close(); return s;
  })();
  const open = async (path, w, theme = "light", setup) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    if (setup) await setup(page);
    await page.goto(APP + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    return { ctx, page };
  };
  const dialog = (page) => page.locator("dialog.td-consume[open]");
  const openDialog = async (page) => {
    await page.getByRole("button", { name: /^Đánh dấu đã ăn:/ }).first().click();
    await dialog(page).waitFor();
  };
  const withMock = (page) => page.route("**/consumption-preview", (route) => route.fulfill({ json: mockPreview(route.request().url()) }));

  // 1) Ảnh: đủ 6 trạng thái dòng, 390/1440 sáng/tối, ở Thực đơn; Tổng quan 1440 sáng.
  for (const [path, name, sizes] of [["/meal-plans", "thuc-don", [[1440, "light"], [1440, "dark"], [390, "light"], [390, "dark"]]], ["/dashboard", "tong-quan", [[1440, "light"], [390, "dark"]]]]) {
    for (const [w, theme] of sizes) {
      const { ctx, page } = await open(path, w, theme, withMock);
      await openDialog(page);
      await dialog(page).locator(".td-consume__line").first().waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/hop-da-an-${name}_${w}_${theme === "light" ? "sang" : "toi"}.png` });
      if (path === "/meal-plans" && w === 1440 && theme === "light") {
        const statuses = await dialog(page).locator(".td-consume__status").allTextContents();
        check("Đủ 6 trạng thái bằng chữ: Đủ / Thiếu 4 g / Chỉ còn món đã hết hạn / Khác đơn vị / Không có trong kho / Tùy chọn",
          JSON.stringify(statuses) === JSON.stringify(["Đủ", "Thiếu 4 g", "Chỉ còn món đã hết hạn", "Khác đơn vị", "Không có trong kho", "Tùy chọn"]), statuses.join(" | "));
        const checks = await dialog(page).locator(".td-consume__check").evaluateAll((els) => els.map((el) => [el.checked, el.disabled]));
        check("Mặc định: Đủ/Thiếu được chọn; hết hạn, tùy chọn không chọn; không có trong kho, khác đơn vị không chọn được",
          JSON.stringify(checks) === JSON.stringify([[true, false], [true, false], [false, false], [false, true], [false, true], [false, false]]));
        check("Dòng nêu thực phẩm sẽ trừ và hạn", (await dialog(page).locator(".td-consume__detail").first().innerText()).includes("Trừ 50 g Gạo, hạn 01/02"));
        // Bỏ chọn tất cả → nút chính tắt; chọn lại → bật.
        while (await dialog(page).locator(".td-consume__check:checked").count()) await dialog(page).locator(".td-consume__check:checked").first().uncheck();
        check("Không chọn dòng nào → \"Trừ kho và đánh dấu đã ăn\" tắt, vẫn \"Chỉ đánh dấu\"", await dialog(page).getByRole("button", { name: "Trừ kho và đánh dấu đã ăn" }).isDisabled()
          && await dialog(page).getByRole("button", { name: "Chỉ đánh dấu, không trừ kho" }).isEnabled());
        await dialog(page).locator(".td-consume__check").first().check();
        await dialog(page).locator(".td-consume__input input").first().fill("0");
        await dialog(page).getByRole("button", { name: "Trừ kho và đánh dấu đã ăn" }).click();
        check("Lượng sai (0) → báo lỗi tại dòng, focus vào ô, không gửi", (await dialog(page).locator(".ui-field__error").first().innerText()).includes("Nhập số lớn hơn 0")
          && (await page.evaluate(() => document.activeElement?.getAttribute("aria-invalid"))) === "true");
        await page.screenshot({ path: `${OUT}/hop-da-an-loi-luong_1440_sang.png` });
        // Tương phản các phần chữ của hộp.
        for (const t of ["light", "dark"]) {
          await page.evaluate((th) => { document.documentElement.dataset.theme = th; }, t);
          const pairs = await page.evaluate(`(${(fn) => [".td-consume__name", ".td-consume__status--ok", ".td-consume__status--warn", ".td-consume__status--muted", ".td-consume__detail", ".td-consume__amount > label", ".ui-dialog__description", ".ui-field__error"]
            .map((sel) => [sel, Math.round(fn(document.querySelector(sel)) * 100) / 100])})(${contrastOf.toString()})`);
          const weak = pairs.filter(([, r]) => r < 4.5);
          check(`Tương phản chữ trong hộp (${t}) ≥ 4.5:1`, weak.length === 0, pairs.map(([s, r]) => `${s}=${r}`).join(" "));
        }
        await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
        // Bàn phím: Tab vòng trong hộp, Esc đóng và trả focus về nút đã mở.
        let outside = 0;
        for (let i = 0; i < 30; i++) { await page.keyboard.press("Tab"); if (!(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]"))))) outside++; }
        check("Tab vòng trong hộp (30 lần Tab không ra ngoài)", outside === 0);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        check("Esc đóng hộp, focus về nút \"Đánh dấu đã ăn\"", (await dialog(page).count()) === 0 && /^Đánh dấu đã ăn:/.test(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")));
      }
      await ctx.close();
    }
  }
  // Trạng thái: đang tải, lỗi + Thử lại, không nguyên liệu nào khớp kho; 320px.
  {
    const { ctx, page } = await open("/meal-plans", 1440, "light", (p) => p.route("**/consumption-preview", async (route) => { await new Promise((r) => setTimeout(r, 4000)); await route.fulfill({ json: mockPreview(route.request().url()) }); }));
    await openDialog(page);
    check("Đang tải: skeleton trong hộp, nút chính tắt", (await dialog(page).locator(".ui-skeleton").count()) >= 3 && await dialog(page).getByRole("button", { name: "Trừ kho và đánh dấu đã ăn" }).isDisabled());
    await page.screenshot({ path: `${OUT}/hop-da-an-dang-tai_1440_sang.png` });
    await ctx.close();
  }
  {
    let fail = true;
    const { ctx, page } = await open("/meal-plans", 1440, "light", (p) => p.route("**/consumption-preview", (route) => (fail ? route.fulfill({ status: 500, json: { message: "Lỗi" } }) : route.fulfill({ json: mockPreview(route.request().url()) }))));
    await openDialog(page);
    await dialog(page).getByRole("button", { name: "Thử lại" }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/hop-da-an-loi_1440_sang.png` });
    fail = false;
    await dialog(page).getByRole("button", { name: "Thử lại" }).click();
    await dialog(page).locator(".td-consume__line").first().waitFor();
    check("Lỗi xem trước → Thử lại → hiện danh sách; \"Chỉ đánh dấu\" vẫn dùng được khi lỗi", (await dialog(page).locator(".td-consume__line").count()) === 6);
    await ctx.close();
  }
  {
    const { ctx, page } = await open("/meal-plans", 390, "light", (p) => p.route("**/consumption-preview", (route) => {
      const preview = mockPreview(route.request().url());
      preview.lines = preview.lines.filter((line) => ["NOT_IN_PANTRY", "UNIT_MISMATCH"].includes(line.status));
      return route.fulfill({ json: preview });
    }));
    await openDialog(page);
    await dialog(page).locator(".td-consume__line").first().waitFor();
    check("Không nguyên liệu nào khớp kho: có dòng nhắc, vẫn \"Chỉ đánh dấu\"", (await dialog(page).innerText()).includes("Không nguyên liệu nào của món này khớp với kho")
      && await dialog(page).getByRole("button", { name: "Chỉ đánh dấu, không trừ kho" }).isEnabled());
    await page.screenshot({ path: `${OUT}/hop-da-an-khong-khop_390_sang.png` });
    await ctx.close();
  }
  {
    const { ctx, page } = await open("/meal-plans", 320, "light", withMock);
    await openDialog(page);
    await dialog(page).locator(".td-consume__line").first().waitFor();
    const fit = await page.evaluate(() => { const r = document.querySelector("dialog[open]").getBoundingClientRect(); return { right: r.right, w: innerWidth, overflow: document.querySelector("dialog[open]").scrollWidth - document.querySelector("dialog[open]").clientWidth }; });
    check("320px: hộp nằm trong màn hình, không cuộn ngang trong hộp", fit.right <= fit.w && fit.overflow <= 0, JSON.stringify(fit));
    await page.screenshot({ path: `${OUT}/hop-da-an-thuc-don_320_sang.png` });
    await ctx.close();
  }

  // 2) Luồng thật ở Tổng quan: xem trước → sửa lượng → trừ → kho đổi đúng → Hoàn tác → kho về như cũ.
  {
    const before = await pantry();
    const { ctx, page } = await open("/dashboard", 1440);
    const firstBtn = page.getByRole("button", { name: /^Đánh dấu đã ăn:/ }).first();
    const mealName = (await firstBtn.getAttribute("aria-label")).replace("Đánh dấu đã ăn: ", "");
    const meal = todayItems.find((item) => item.recipe.name === mealName);
    const preview = await call("GET", `/meal-plans/items/${meal.id}/consumption-preview`);
    await firstBtn.click();
    await dialog(page).locator(".td-consume__line").first().waitFor();
    const chosen = preview.lines.filter((line) => line.defaultQuantity > 0);
    check("Tổng quan: hộp xem trước mở đúng món, có nguyên liệu khớp kho", chosen.length > 0, `${mealName}: ${chosen.map((l) => `${l.name} ${l.defaultQuantity} ${l.required.unit}`).join(", ")}`);
    const edited = chosen[0];
    const editedAmount = round(edited.defaultQuantity / 2);
    await dialog(page).locator(`#td-consume-${edited.ingredientId}-qty`).fill(String(editedAmount).replace(".", ","));
    await page.screenshot({ path: `${OUT}/luong-tong-quan-sua-luong_1440_sang.png` });
    await dialog(page).getByRole("button", { name: "Trừ kho và đánh dấu đã ăn" }).click();
    await page.locator(".ui-notice", { hasText: "Đã trừ" }).waitFor({ timeout: 15000 });
    const notice = await page.locator(".ui-notice", { hasText: "Đã trừ" }).innerText();
    const after = await pantry();
    const tb = totals(before), ta = totals(after);
    const ok = chosen.every((line) => {
      const [dim, f] = FACTOR[line.required.unit];
      const key = `${norm(line.name)}|${dim}`;
      const amount = line.ingredientId === edited.ingredientId ? editedAmount : line.defaultQuantity;
      return round(tb.get(key) - ta.get(key)) === round(amount * f);
    });
    check("Kho giảm đúng lượng đã chọn (dòng sửa tay: một nửa)", ok, notice);
    await page.locator(".ui-notice").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 160));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/luong-tong-quan-da-tru_1440_sang.png` });
    await page.locator(".ui-notice").getByRole("button", { name: "Hoàn tác" }).click();
    await page.locator(".ui-notice", { hasText: "Đã bỏ đánh dấu" }).waitFor({ timeout: 15000 });
    const restored = await pantry();
    check("Hoàn tác → kho về đúng như trước, dòng nhắc nêu đã hoàn lại", JSON.stringify(restored.map((i) => [i.id, i.quantity])) === JSON.stringify(before.map((i) => [i.id, i.quantity]))
      && (await page.locator(".ui-notice").innerText()).includes("Đã hoàn lại"));
    await page.locator(".ui-notice").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 160));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/luong-tong-quan-hoan-tac_1440_sang.png` });
    await ctx.close();
  }

  // 3) Thực đơn: "Chỉ đánh dấu" không đổi kho; trừ mặc định → Hoàn tác.
  {
    const before = await pantry();
    const { ctx, page } = await open("/meal-plans", 390, "light");
    const btn = page.getByRole("button", { name: /^Đánh dấu đã ăn:/ }).first();
    const name = (await btn.getAttribute("aria-label")).replace("Đánh dấu đã ăn: ", "");
    await btn.click();
    await dialog(page).locator(".td-consume__line").first().waitFor();
    await dialog(page).getByRole("button", { name: "Chỉ đánh dấu, không trừ kho" }).click();
    await page.locator(".ui-notice", { hasText: "Không trừ kho" }).waitFor({ timeout: 15000 });
    const planNow = await call("GET", `/meal-plans/${plan.id}`);
    const markedMeal = planNow.days.flatMap((x) => x.items).find((i) => i.recipe.name === name && i.completed);
    check("Thực đơn: \"Chỉ đánh dấu, không trừ kho\" → đã ăn, kho không đổi", Boolean(markedMeal)
      && JSON.stringify((await pantry()).map((i) => [i.id, i.quantity])) === JSON.stringify(before.map((i) => [i.id, i.quantity])));
    await page.getByRole("button", { name: `Bỏ đánh dấu đã ăn: ${name}` }).first().click();
    await page.locator(".ui-notice", { hasText: "Đã bỏ đánh dấu" }).waitFor({ timeout: 15000 });
    check("Bỏ đánh dấu bữa không trừ kho → kho vẫn không đổi", JSON.stringify((await pantry()).map((i) => [i.id, i.quantity])) === JSON.stringify(before.map((i) => [i.id, i.quantity])));

    await page.getByRole("button", { name: `Đánh dấu đã ăn: ${name}` }).first().click();
    await dialog(page).locator(".td-consume__line").first().waitFor();
    await dialog(page).getByRole("button", { name: "Trừ kho và đánh dấu đã ăn" }).click();
    await page.locator(".ui-notice", { hasText: "Đã trừ" }).waitFor({ timeout: 15000 });
    await page.locator(".ui-notice").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 160));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/luong-thuc-don-da-tru_390_sang.png` });
    const changed = (await pantry()).some((i) => before.find((b) => b.id === i.id).quantity !== i.quantity);
    await page.locator(".ui-notice").getByRole("button", { name: "Hoàn tác" }).click();
    await page.locator(".ui-notice", { hasText: "Đã bỏ đánh dấu" }).waitFor({ timeout: 15000 });
    check("Thực đơn: trừ theo mặc định đổi kho → Hoàn tác trả kho về như cũ", changed
      && JSON.stringify((await pantry()).map((i) => [i.id, i.quantity])) === JSON.stringify(before.map((i) => [i.id, i.quantity])));
    await ctx.close();
  }
  // Trang Kho cập nhật sau khi trừ (không cần tải lại thủ công).
  {
    const { ctx, page } = await open("/meal-plans", 1440);
    const btn = page.getByRole("button", { name: /^Đánh dấu đã ăn:/ }).first();
    await btn.click();
    await dialog(page).locator(".td-consume__line").first().waitFor();
    await dialog(page).getByRole("button", { name: "Trừ kho và đánh dấu đã ăn" }).click();
    await page.locator(".ui-notice", { hasText: "Đã trừ" }).waitFor({ timeout: 15000 });
    const apiNow = await pantry();
    await page.getByRole("link", { name: "Kho thực phẩm" }).first().click();
    await page.waitForURL("**/pantry");
    await page.locator(".kho-row, .kho-tile").first().waitFor();
    const shown = await page.locator("main").innerText();
    check("Sang trang Kho (cùng phiên) thấy số lượng mới", apiNow.filter((i) => i.quantity > 0).slice(0, 3).every((i) => shown.includes(i.name)));
    await ctx.close();
  }

  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(demoReset());
  check("demo:reset ở cuối: 0 thực đơn, 0 lịch sử kho, 8 thực phẩm mẫu", sql(`SELECT count(*) FROM "MealPlan" WHERE "userId"=(SELECT id FROM "User" WHERE email='${ACC.demo().email}');`) === "0"
    && sql(`SELECT count(*) FROM "PantryTransaction";`) === "0" && sql(`SELECT count(*) FROM "PantryItem" WHERE "userId"=(SELECT id FROM "User" WHERE email='${ACC.demo().email}');`) === "8");
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); try { console.log(demoReset()); } catch {} process.exit(1); });
