// GĐ3b lượt 6: nghiệm thu "Đã mua" → kho (cộng vào / tạo mới có "Hạn ước tính" / bỏ tick về như cũ).
// node gd3b-l6-check.cjs <thư mục ảnh>. Đầu và cuối chạy demo:reset.
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
const norm = (s) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UNIT_GROUP = { G: "m", KG: "m", ML: "v", L: "v", ITEM: "i", PACKAGE: "p" };
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
  const snapshot = async () => (await call("GET", "/pantry")).map((i) => `${i.name}|${i.quantity}|${i.unit}|${i.expiryDate}|${i.expiryEstimated}`).sort().join("\n");
  const before = await snapshot();

  const d = new Date();
  const plan = await call("POST", "/meal-plans/generate", { startDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` });
  const pantry = await call("GET", "/pantry");
  const inPantry = (s) => pantry.find((p) => norm(p.name) === norm(s.name) && UNIT_GROUP[p.unit] === UNIT_GROUP[s.unit] && p.quantity > 0);
  // B: món đã có trong kho (cộng vào). A: món chưa có, thuộc nhóm có hạn gợi ý (tạo mới, "Hạn ước tính").
  const merge = plan.shoppingItems.find(inPantry);
  const create = plan.shoppingItems.find((s) => !pantry.some((p) => norm(p.name) === norm(s.name)) && s.category !== "Khác" && s.category !== "Gia vị");
  check("Thực đơn có dòng đi chợ đã có trong kho và dòng chưa có", merge && create, `cộng vào: ${merge?.name} ${merge?.quantity} ${merge?.unit}; tạo mới: ${create?.name} (${create?.category})`);
  const target = inPantry(merge);

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
    await page.waitForTimeout(300);
    return { ctx, page };
  };
  const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const shopRow = (page, name) => page.locator(".td-shop-item").filter({ has: page.locator(".td-shop-item__name", { hasText: new RegExp(`^\\s*Đã mua:\\s*${esc(name)}\\s*$`) }) });
  const notice = (page) => page.locator(".td-shopping .ui-notice");
  const tick = async (page, name, waitText) => {
    const res = page.waitForResponse((r) => r.url().includes("/meal-plans/shopping/") && r.request().method() === "PATCH");
    await shopRow(page, name).locator("input").click();
    const body = await (await res).json();
    await notice(page).filter({ hasText: waitText }).waitFor();
    await page.waitForLoadState("networkidle").catch(() => {});
    return body;
  };
  const planPath = `/meal-plans/${plan.id}`;

  // 1) Luồng chính (1440 sáng): mở Kho trước để có cache, rồi tick → "Sửa" mở Kho thấy ngay số mới (đã làm mới dữ liệu).
  {
    const { ctx, page } = await open("/pantry", 1440);
    await page.getByRole("link", { name: "Thực đơn" }).first().click();
    await page.waitForURL(/meal-plans\//);
    await page.waitForLoadState("networkidle").catch(() => {});
    check("Điều hướng trong ứng dụng tới đúng thực đơn (giữ cache Kho)", page.url().endsWith(planPath));
    const dashBefore = await call("GET", "/dashboard");

    const merged = await tick(page, merge.name, "Đã thêm");
    const mergedText = await notice(page).innerText();
    check("Tick món đã có trong kho → cộng vào thực phẩm sẵn có (không hộp thoại)", merged.pantry?.action === "MERGED" && merged.pantry.pantryItemId === target.id
      && (await page.locator("dialog[open]").count()) === 0, mergedText.replace(/\s+/g, " "));
    const afterMerge = (await call("GET", "/pantry")).find((p) => p.id === target.id);
    check("Kho: số lượng thực phẩm sẵn có tăng đúng lượng mua (quy đổi nếu khác đơn vị)", Math.abs(afterMerge.quantity - merged.pantry.quantityAfter) < 1e-9
      && afterMerge.quantity > target.quantity, `${target.quantity} → ${afterMerge.quantity} ${afterMerge.unit}`);

    const created = await tick(page, create.name, create.name);
    const createdText = (await notice(page).innerText()).replace(/\s+/g, " ");
    check("Dòng nhắc nằm trong vùng aria-live luôn có sẵn", (await page.locator(".td-shop-live[aria-live=polite]").innerText()).includes("Đã thêm"));
    const createdItem = (await call("GET", "/pantry")).find((p) => p.id === created.pantry?.pantryItemId);
    check("Tick món chưa có → tạo thực phẩm mới đúng nhóm, hạn gợi ý, hạn ước tính", created.pantry?.action === "CREATED" && createdItem?.expiryEstimated === true
      && createdItem.category === create.category && Boolean(createdItem.expiryDate)
      && (create.name !== "Bánh mì" || (createdItem.storageLocation === "REFRIGERATOR" && Math.round((new Date(createdItem.expiryDate) - Date.now()) / 86400000) <= 2)), `${createdItem?.name}: ${createdItem?.category}, ${createdItem?.storageLocation}, hạn ${createdItem?.expiryDate}`);
    check("Dòng nhắc ghi \"Đã thêm … vào kho\" và \"hạn ước tính\", có liên kết \"Sửa\"", /Đã thêm .* vào kho/.test(createdText) && /hạn ước tính/.test(createdText)
      && (await notice(page).getByRole("link", { name: "Sửa" }).getAttribute("href")) === `/pantry?item=${createdItem.id}`, createdText);
    const tx = sql(`SELECT source, "shoppingItemId", delta FROM "PantryTransaction" WHERE "shoppingItemId" IN ('${merge.id}','${create.id}') ORDER BY "createdAt";`);
    check("Lịch sử kho: 2 dòng PURCHASE gắn dòng đi chợ", tx.split("\n").length === 2 && tx.split("\n").every((l) => l.startsWith("PURCHASE|")), tx.replace(/\n/g, "; "));

    // Tick lại qua API: không cộng thêm.
    const again = await call("PATCH", `/meal-plans/shopping/${merge.id}`, { purchased: true });
    check("Tick lại lần nữa (gửi lại) không cộng thêm", again.alreadyPurchased === true && again.pantry === null
      && (await call("GET", "/pantry")).find((p) => p.id === target.id).quantity === afterMerge.quantity);

    // Tổng quan nhận số mới (kho tăng 1 món).
    const dashAfter = await call("GET", "/dashboard");
    check("Tổng quan: số thực phẩm trong kho tăng 1 (món tạo mới)", dashAfter.pantryCount === dashBefore.pantryCount + 1, `${dashBefore.pantryCount} → ${dashAfter.pantryCount}`);

    // Tab tới "Sửa", focus thấy được.
    await notice(page).getByRole("link", { name: "Sửa" }).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0; });
    check("\"Sửa\" nhận focus bàn phím, có viền focus", outline);
    for (const theme of ["light"]) {
      const ratio = await page.evaluate(`(${contrastOf.toString()})(document.querySelector(".td-shopping .ui-notice"))`);
      check(`Tương phản dòng nhắc (${theme}) ≥ 4.5:1`, ratio >= 4.5, ratio.toFixed(2));
    }

    // "Sửa" → Kho (SPA, cache cũ) thấy ngay thực phẩm mới, dòng được focus, có "Hạn ước tính".
    await notice(page).getByRole("link", { name: "Sửa" }).click();
    await page.waitForURL(/\/pantry/);
    const row = page.locator(`[id$="${createdItem.id}"]`);
    await row.waitFor();
    await page.waitForTimeout(400);
    check("\"Sửa\" mở Kho đúng thực phẩm (dòng được làm nổi bật), hiện \"Hạn ước tính\"", (await row.getAttribute("class")).includes("kho-item--focus")
      && (await row.innerText()).includes("Hạn ước tính"), (await row.innerText()).replace(/\s+/g, " "));
    await page.screenshot({ path: `${OUT}/kho-han-uoc-tinh_1440_sang.png`, fullPage: true });
    const kRatio = await page.evaluate(`(${contrastOf.toString()})([...document.querySelectorAll(".kho-sub")].find((e) => e.textContent === "Hạn ước tính"))`);
    check("Tương phản chữ \"Hạn ước tính\" (sáng) ≥ 4.5:1", kRatio >= 4.5, kRatio.toFixed(2));

    // Hộp thoại Sửa: gợi ý "Hạn ước tính".
    await row.getByRole("button", { name: /Sửa/ }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.waitFor();
    check("Hộp thoại Sửa ghi \"Hạn ước tính\" dưới ô hạn", (await dialog.innerText()).includes("Hạn ước tính theo nhóm"));
    await page.screenshot({ path: `${OUT}/kho-sua-han-uoc-tinh_1440_sang.png` });
    await dialog.getByRole("button", { name: "Hủy" }).click();
    await ctx.close();

    // Bỏ tick cả hai (giao diện) → kho về như cũ.
    const back = await open(planPath, 1440);
    const undoCreate = await tick(back.page, create.name, "bỏ đánh dấu");
    const undoText = (await notice(back.page).innerText()).replace(/\s+/g, " ");
    check("Bỏ tick món tạo mới → xóa hẳn thực phẩm, dòng nhắc nêu đã xóa", undoCreate.restoration?.restored[0]?.removed === true && /Đã xóa .* khỏi kho/.test(undoText), undoText);
    await back.page.screenshot({ path: `${OUT}/thuc-don-bo-tick_1440_sang.png` });
    const undoMerge = await tick(back.page, merge.name, "bỏ đánh dấu");
    const undoMergeText = (await notice(back.page).innerText()).replace(/\s+/g, " ");
    check("Bỏ tick món cộng vào → trừ lại đúng lượng, dòng nhắc nêu đã trừ lại", undoMerge.restoration?.restored[0]?.removed === false && /Đã trừ lại/.test(undoMergeText), undoMergeText);
    check("Kho về đúng như trước khi tick (tên, số lượng, hạn, cờ ước tính)", (await snapshot()) === before);
    const reversals = sql(`SELECT count(*) FROM "PantryTransaction" WHERE "reversalOfId" IS NOT NULL AND "shoppingItemId" IN ('${merge.id}','${create.id}');`);
    const claimed = sql(`SELECT count(*) FROM "PantryTransaction" WHERE "reversedAt" IS NOT NULL AND "shoppingItemId" IN ('${merge.id}','${create.id}');`);
    check("Lịch sử: 2 dòng hoàn lại trỏ reversalOfId, 2 dòng gốc đã đánh dấu hoàn", reversals === "2" && claimed === "2", `${reversals}/${claimed}`);
    const twice = await call("PATCH", `/meal-plans/shopping/${create.id}`, { purchased: false });
    check("Bỏ tick lần nữa không hoàn lại hai lần", twice.restoration.restored.length === 0 && twice.restoration.skipped.length === 0 && (await snapshot()) === before);
    await back.ctx.close();
  }

  // 2) Người dùng sửa hạn → mất "Hạn ước tính"; bỏ tick lúc đó → trừ lại (không xóa vì đã bị sửa).
  {
    const bought = await call("PATCH", `/meal-plans/shopping/${create.id}`, { purchased: true });
    const id = bought.pantry.pantryItemId;
    const { ctx, page } = await open(`/pantry?item=${id}`, 1440);
    const row = page.locator(`[id$="${id}"]`);
    await row.waitFor();
    await row.getByRole("button", { name: /Sửa/ }).click();
    const dialog = page.locator("dialog[open]");
    const dateInput = dialog.getByLabel("Hạn sử dụng");
    const later = new Date(Date.now() + 20 * 86400000);
    await dateInput.fill(`${String(later.getDate()).padStart(2, "0")}/${String(later.getMonth() + 1).padStart(2, "0")}/${later.getFullYear()}`);
    check("Hộp thoại: đổi sang ngày khác thì gợi ý \"Hạn ước tính\" biến mất", !(await dialog.innerText()).includes("Hạn ước tính theo nhóm"));
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    await dialog.waitFor({ state: "detached" }).catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    const item = (await call("GET", "/pantry")).find((p) => p.id === id);
    await page.getByRole("searchbox").fill(item.name);
    await row.waitFor();
    check("Lưu ngày mới → expiryEstimated = false, Kho không còn \"Hạn ước tính\"", item.expiryEstimated === false && !(await row.innerText()).includes("Hạn ước tính"));
    await ctx.close();
    const undo = await call("PATCH", `/meal-plans/shopping/${create.id}`, { purchased: false });
    const left = (await call("GET", "/pantry")).find((p) => p.id === id);
    check("Bỏ tick khi thực phẩm đã bị sửa → trừ lại (không xóa), còn 0 = \"Đã dùng hết\"", undo.restoration.restored[0]?.removed === false && left?.quantity === 0);
    await call("DELETE", `/pantry/${id}`);
  }

  // 3) Ảnh nghiệm thu 390/1440 sáng/tối: dòng nhắc sau tick (tạo mới) và Kho có "Hạn ước tính"; bỏ tick để về như cũ.
  for (const w of [390, 1440]) for (const theme of ["light", "dark"]) {
    const t = theme === "light" ? "sang" : "toi";
    const { ctx, page } = await open(planPath, w, theme);
    await tick(page, create.name, "Đã thêm");
    // Dòng nhắc dính đáy màn hình: vẫn thấy ngay khi tick món ở giữa/cuối danh sách dài.
    const box = await notice(page).boundingBox();
    const vh = page.viewportSize().height;
    check(`Thực đơn ${w}px ${theme}: dòng nhắc nằm trong màn hình ngay sau khi tick`, box && box.y >= 0 && box.y + box.height <= vh, `y=${Math.round(box?.y)}..${Math.round(box?.y + box?.height)} / ${vh}`);
    await page.screenshot({ path: `${OUT}/di-cho-da-them_${w}_${t}.png` });
    check(`Thực đơn ${w}px ${theme}: không cuộn ngang khi có dòng nhắc`, (await noOverflow(page)) <= 0);
    if (theme === "dark") {
      const ratio = await page.evaluate(`(${contrastOf.toString()})(document.querySelector(".td-shopping .ui-notice"))`);
      check(`Tương phản dòng nhắc (tối, ${w}px) ≥ 4.5:1`, ratio >= 4.5, ratio.toFixed(2));
    }
    await notice(page).getByRole("link", { name: "Sửa" }).click();
    await page.waitForURL(/\/pantry/);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/kho-han-uoc-tinh_${w}_${t}.png`, fullPage: true });
    if (theme === "dark") {
      const r = await page.evaluate(`(${contrastOf.toString()})([...document.querySelectorAll(".kho-sub")].find((e) => e.textContent === "Hạn ước tính"))`);
      check(`Tương phản "Hạn ước tính" (tối, ${w}px) ≥ 4.5:1`, r >= 4.5, r.toFixed(2));
    }
    await ctx.close();
    await call("PATCH", `/meal-plans/shopping/${create.id}`, { purchased: false });
  }
  check("Sau các lượt chụp ảnh, kho về đúng như trước", (await snapshot()) === before);

  // 4) 320px.
  {
    const { ctx, page } = await open(planPath, 320);
    await tick(page, create.name, "Đã thêm");
    check("320px: dòng nhắc + \"Sửa\" không cuộn ngang", (await noOverflow(page)) <= 0);
    await ctx.close();
    await call("PATCH", `/meal-plans/shopping/${create.id}`, { purchased: false });
  }

  check("Không có lỗi JavaScript", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(demoReset());
  console.log(`\n${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
