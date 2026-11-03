// Nghiệm thu UI-6 (Thực đơn). node ui6-check.cjs <thư mục ảnh docs>
// Dữ liệu thử: thực đơn của demo (lúc bắt đầu lượt demo không có thực đơn nào); cuối script xóa hết qua API.
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const [OUT] = process.argv.slice(2);
const AFTER = "http://localhost:5173";
const BEFORE = "http://localhost:8080";
const API = "http://localhost:4000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };

async function sessionFor(browser, base) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(base + "/login");
  await page.locator('input[type="email"]').fill(ACC.demo().email);
  await page.locator('input[type="password"]').fill(ACC.demo().password);
  await page.locator('input[type="password"]').press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

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

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const token = (await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json()).token;
  const call = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return res.status === 204 ? null : res.json();
  };
  const plans = () => call("GET", "/meal-plans");
  const plan = (id) => call("GET", `/meal-plans/${id}`);
  const today = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

  // Hai thực đơn: một bắt đầu hôm nay (đang áp dụng), một tuần sau (bản nháp).
  for (const p of await plans()) await call("DELETE", `/meal-plans/${p.id}`);
  {
    const first = await call("POST", "/meal-plans/generate", { startDate: iso(today) });
    await call("PATCH", `/meal-plans/${first.id}/status`, { status: "ACTIVE" });
    await call("POST", "/meal-plans/generate", { startDate: iso(addDays(7)) });
  }
  let list = await plans();
  const active = list.find((p) => p.status === "ACTIVE");
  const draft = list.find((p) => p.status === "DRAFT");

  const after = await sessionFor(browser, AFTER);
  const before = await sessionFor(browser, BEFORE);
  const open = async (state, base, path, w, theme = "light", setup) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    if (base === AFTER) {
      page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
    }
    if (setup) await setup(page);
    await page.goto(base + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    return { ctx, page };
  };
  const themeName = (t) => (t === "light" ? "sang" : "toi");

  // 1) Trước/sau 390 & 1440, sáng & tối; danh sách đi chợ.
  for (const w of [390, 1440]) {
    let { ctx, page } = await open(before, BEFORE, `/meal-plans/${active.id}`, w);
    await page.screenshot({ path: `${OUT}/thuc-don_${w}_truoc.png`, fullPage: true });
    await ctx.close();
    for (const theme of ["light", "dark"]) {
      ({ ctx, page } = await open(after, AFTER, `/meal-plans/${active.id}`, w, theme));
      await page.screenshot({ path: `${OUT}/thuc-don_${w}_sau_${themeName(theme)}.png`, fullPage: true });
      await page.locator(".td-shopping").screenshot({ path: `${OUT}/di-cho_${w}_${themeName(theme)}.png` });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(`Thực đơn ${w}px ${theme}: không cuộn ngang, một <main>, nội dung đổi theo chế độ`,
        overflow <= 0 && (await page.locator("main").count()) === 1 && (await page.locator("#noi-dung-chinh").getAttribute("data-theme")) === null, `${overflow}px`);
      if (w === 390) {
        const rows = await page.locator(".td-shop-item").evaluateAll((els) => els.slice(0, 5).map((el) => Math.round(el.getBoundingClientRect().height)));
        check(`Đi chợ 390px ${theme}: cả dòng là vùng bấm ≥ 48px`, rows.length > 0 && rows.every((h) => h >= 48), rows.join(","));
      }
      await ctx.close();
    }
  }

  // 2) Đầu trang, thanh ngày, đổi ngày, hôm nay, bàn phím.
  {
    const { ctx, page } = await open(after, AFTER, `/meal-plans/${active.id}`, 1440);
    const h1 = (await page.locator("h1").innerText()).replace(/\s+/g, " ");
    check("H1 là tên thực đơn, một cụm nghiêng", h1 === active.name && (await page.locator("h1 em").count()) === 1, h1);
    check("Nhãn trạng thái + nguồn thật", (await page.locator(".td-hero__meta").innerText()).includes("Đang áp dụng") && (await page.locator(".td-hero__meta").innerText()).includes(active.aiGenerated ? "Tạo bởi AI" : "Thuật toán gợi ý"));
    const ai = await call("GET", "/ai/status");
    check("Nút Tạo thực đơn ghi cách tạo theo /api/ai/status", (await page.locator(".td-create__source").innerText()) === `Cách tạo: ${ai.available ? "Tạo bởi AI" : "Thuật toán gợi ý"}`);
    const tabs = page.getByRole("tab");
    check("Thanh 7 ngày, hôm nay nổi bật và được chọn sẵn", (await tabs.count()) === 7 && (await tabs.nth(0).getAttribute("aria-selected")) === "true"
      && (await tabs.nth(0).getAttribute("class")).includes("td-day--today") && (await tabs.nth(0).innerText()).includes("Hôm nay"));
    const navCount = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    const url = page.url();
    await tabs.nth(3).click();
    const title = await page.locator(".td-day-panel__title").innerText();
    const detail = await plan(active.id);
    const day3 = detail.days[3];
    const firstMeal = [...day3.items].sort((a, b) => ["BREAKFAST", "LUNCH", "SNACK", "DINNER"].indexOf(a.mealType) - ["BREAKFAST", "LUNCH", "SNACK", "DINNER"].indexOf(b.mealType))[0];
    check("Đổi ngày: không tải lại trang, URL giữ nguyên, hiện đúng bữa của ngày", page.url() === url && navCount === await page.evaluate(() => performance.getEntriesByType("navigation").length)
      && (await page.locator(".td-meal__name").first().innerText()) === firstMeal.recipe.name, title);
    await tabs.nth(3).focus();
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => ({ id: document.activeElement.id, selected: document.activeElement.getAttribute("aria-selected") }));
    await page.keyboard.press("End");
    const end = await page.evaluate(() => document.activeElement.id);
    await page.keyboard.press("Home");
    check("Bàn phím: mũi tên/Home/End đổi ngày và chuyển focus, chỉ ngày đang chọn nhận Tab",
      focused.id === "td-day-tab-4" && focused.selected === "true" && end === "td-day-tab-6"
      && (await page.locator("[role=tab][tabindex='0']").count()) === 1, JSON.stringify(focused));
    const links = await page.locator(".td-meal__name").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    check("Tên món link sang chi tiết công thức", links.length > 0 && links.every((href) => /^\/recipes\/c[a-z0-9]+$/.test(href)));
    const order = await page.locator(".td-meal__type > span:first-child").allInnerTexts();
    check("Bữa theo thứ tự sáng, trưa, (phụ), tối", JSON.stringify(order) === JSON.stringify([...order].sort((a, b) => ["Bữa sáng", "Bữa trưa", "Bữa phụ", "Bữa tối"].indexOf(a) - ["Bữa sáng", "Bữa trưa", "Bữa phụ", "Bữa tối"].indexOf(b))), order.join(","));
    check("Chỉ một nút chính \"Đã ăn\" (bữa kế tiếp) trong ngày", (await page.locator(".td-meals .ui-button--primary").count()) <= 1);
    await ctx.close();
  }

  // 3) Đã ăn + Hoàn tác, Bỏ đánh dấu, món ngày khác, Đã mua.
  {
    const { ctx, page } = await open(after, AFTER, `/meal-plans/${active.id}`, 1440);
    const name = await page.locator(".td-meal__name").first().innerText();
    const id = (await plan(active.id)).days[0].items.find((i) => i.recipe.name === name).id;
    const completed = async () => (await plan(active.id)).days.flatMap((d) => d.items).find((i) => i.id === id).completed;
    await page.getByRole("button", { name: `Đánh dấu đã ăn: ${name}` }).click();
    await page.locator(".ui-notice", { hasText: "Đã đánh dấu đã ăn" }).waitFor();
    check("Đã ăn: dòng xác nhận đúng động từ, API completed=true", (await completed()) === true && (await page.locator(".td-meal").first().innerText()).includes("Đã ăn"));
    await page.screenshot({ path: `${OUT}/thuc-don-da-an_1440_sang.png` });
    await page.locator(".ui-notice").getByRole("button", { name: "Hoàn tác" }).click();
    await page.locator(".ui-notice", { hasText: "Đã bỏ đánh dấu" }).waitFor();
    check("Hoàn tác: API completed=false", (await completed()) === false);
    await page.getByRole("button", { name: `Đánh dấu đã ăn: ${name}` }).click();
    await page.getByRole("button", { name: `Bỏ đánh dấu đã ăn: ${name}` }).click();
    await page.locator(".ui-notice", { hasText: "Đã bỏ đánh dấu" }).waitFor();
    check("Bỏ đánh dấu trên dòng đã ăn", (await completed()) === false);
    const details = page.locator(".td-meal__others").first();
    await details.locator("summary").click();
    const otherButton = details.getByRole("button").first();
    const otherLabel = await otherButton.getAttribute("aria-label");
    await otherButton.click();
    await page.locator(".ui-notice", { hasText: "Đã đánh dấu đã ăn" }).waitFor();
    const doneCount = (await plan(active.id)).days.flatMap((d) => d.items).filter((i) => i.completed).length;
    check("Món cùng bữa ngày khác: đánh dấu được (giữ chức năng cũ)", doneCount === 1, otherLabel);
    await page.locator(".ui-notice").getByRole("button", { name: "Hoàn tác" }).click();
    await page.waitForTimeout(600);
    const shopName = (await page.locator(".td-shop-item").first().locator(".td-shop-item__name").innerText()).replace(/^Đã mua:\s*/, "");
    const shop = page.locator(".td-shop-item").filter({ hasText: shopName }).first();
    await shop.click();
    await page.waitForFunction(() => document.querySelector(".td-shopping__count")?.textContent?.startsWith("Đã mua 1/"));
    const bought = (await plan(active.id)).shoppingItems.find((i) => i.name === shopName);
    check("Đã mua: bấm cả dòng, API purchased=true, đếm cập nhật", bought?.purchased === true && (await shop.getAttribute("class")).includes("is-bought"), shopName);
    await shop.click();
    await page.waitForFunction(() => document.querySelector(".td-shopping__count")?.textContent?.startsWith("Đã mua 0/"));
    check("Bỏ tick Đã mua: API purchased=false", (await plan(active.id)).shoppingItems.find((i) => i.name === shopName).purchased === false);
    const groups = await page.locator(".td-shop-group__title").allInnerTexts();
    check("Đi chợ nhóm theo loại", groups.length >= 4 && groups[0] === "Rau củ", groups.join(", "));
    const label = await shop.locator("input").evaluate((el) => el.labels[0].textContent.replace(/\s+/g, " ").trim());
    check("Ô tick có tên đọc \"Đã mua: …\"", label.startsWith("Đã mua:"), label);
    await ctx.close();
  }

  // 4) Đổi thực đơn (giữ vị trí cuộn), áp dụng, tạo mới (trạng thái chờ), xóa.
  {
    const { ctx, page } = await open(after, AFTER, `/meal-plans/${active.id}`, 1440);
    await page.evaluate(() => scrollTo(0, 120));
    await page.waitForTimeout(200);
    const y0 = await page.evaluate(() => scrollY);
    await page.locator("#td-plan-select").selectOption(draft.id);
    await page.waitForURL(`**/meal-plans/${draft.id}`);
    await page.waitForTimeout(500);
    check("Đổi thực đơn: route /meal-plans/:id, giữ vị trí cuộn", (await page.locator("h1").innerText()).replace(/\s+/g, " ") === draft.name && Math.abs((await page.evaluate(() => scrollY)) - y0) < 4, `${y0} → ${await page.evaluate(() => scrollY)}`);
    await page.getByRole("button", { name: "Áp dụng thực đơn" }).click();
    await page.locator(".ui-toast").waitFor();
    check("Áp dụng: thông báo + API ACTIVE", (await page.locator(".ui-toast").innerText()).includes(`Đã áp dụng “${draft.name}”`) && (await plan(draft.id)).status === "ACTIVE");

    // Tạo mới: trì hoãn phản hồi để chụp trạng thái chờ.
    await page.route("**/api/meal-plans/generate", async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
    const start = addDays(14);
    const display = `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}/${start.getFullYear()}`;
    await page.getByLabel("Ngày bắt đầu").fill("31/02/2026");
    await page.getByRole("button", { name: "Tạo thực đơn" }).click();
    check("Ngày sai: báo dưới ô, không gửi", (await page.locator(".td-create .ui-field__error").innerText()).includes("dd/mm/yyyy"));
    await page.getByLabel("Ngày bắt đầu").fill(display);
    await page.getByRole("button", { name: "Tạo thực đơn" }).click();
    await page.locator(".ui-notice", { hasText: "Đang tạo thực đơn 7 ngày" }).waitFor();
    check("Đang tạo: dòng chờ rõ ràng + nút khóa", (await page.getByRole("button", { name: "Đang tạo thực đơn..." }).getAttribute("aria-busy")) === "true");
    await page.screenshot({ path: `${OUT}/thuc-don-dang-tao_1440_sang.png` });
    await page.locator(".ui-toast", { hasText: "Đã tạo" }).waitFor({ timeout: 30000 });
    list = await plans();
    const created = list.find((p) => p.startDate.slice(0, 10) === iso(start));
    check("Tạo: mở thực đơn mới, thông báo", created && page.url().endsWith(`/meal-plans/${created.id}`), page.url());

    // Xóa thực đơn đang áp dụng (draft vừa áp dụng).
    await page.locator("#td-plan-select").selectOption(draft.id);
    await page.waitForURL(`**/meal-plans/${draft.id}`);
    await page.getByRole("button", { name: "Xóa thực đơn" }).click();
    const dialog = page.locator("dialog.ui-dialog[open]");
    await dialog.waitFor();
    const text = await dialog.innerText();
    check("Xóa: hộp xác nhận nêu tên, nói đang áp dụng và hậu quả", text.includes(`Xóa “${draft.name}”?`) && text.includes("đang được áp dụng") && text.includes("Không hoàn tác được"));
    await page.screenshot({ path: `${OUT}/thuc-don-xoa_1440_sang.png` });
    await dialog.getByRole("button", { name: "Hủy" }).click();
    check("Xóa → Hủy: thực đơn còn", (await plans()).some((p) => p.id === draft.id));
    await page.getByRole("button", { name: "Xóa thực đơn" }).click();
    await page.locator("dialog.ui-dialog[open]").getByRole("button", { name: "Xóa thực đơn" }).click();
    await page.locator(".ui-toast", { hasText: "Đã xóa" }).waitFor();
    check("Xóa: thông báo, API không còn, chuyển về thực đơn mới nhất", !(await plans()).some((p) => p.id === draft.id) && /\/meal-plans\/c/.test(page.url()));
    await ctx.close();
  }

  // 5) Link: Tổng quan → thực đơn; thực đơn không tồn tại; link thông báo.
  {
    const { ctx, page } = await open(after, AFTER, "/meal-plans/khong-ton-tai", 1440);
    await page.locator(".ui-notice", { hasText: "Không tìm thấy thực đơn này" }).waitFor();
    check("Thực đơn không tìm thấy: dòng nhắc và về thực đơn mới nhất", /\/meal-plans\/c/.test(page.url()));
    await page.goto(AFTER + "/dashboard");
    await page.waitForLoadState("networkidle");
    const weekLink = page.getByRole("link", { name: "Xem cả tuần" });
    if (await weekLink.count()) {
      await weekLink.click();
      await page.waitForURL(/\/meal-plans\/c/);
      check("Tổng quan \"Xem cả tuần\" mở đúng thực đơn đang áp dụng", (await page.locator(".td-hero__meta").innerText()).includes("Đang áp dụng"));
    } else check("Tổng quan \"Xem cả tuần\" mở đúng thực đơn đang áp dụng", false, "không có link");
    // Link thông báo: giả lập một thông báo (không đổi trạng thái đã đọc của demo).
    const fake = { id: "fake-notice", userId: "demo", type: "PANTRY_EXPIRING", title: "Thực phẩm sắp hết hạn", message: "Thử link", relatedId: "x",
      actionUrl: "/pantry?item=khong-con", isRead: false, createdAt: new Date().toISOString() };
    await page.route("**/api/notifications?**", (route) => route.fulfill({ json: [fake] }));
    await page.route("**/api/notifications/unread-count", (route) => route.fulfill({ json: { count: 1 } }));
    await page.route("**/api/notifications/fake-notice/read", (route) => route.fulfill({ json: { ...fake, isRead: true } }));
    await page.goto(AFTER + `/meal-plans/${active.id}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^Thông báo/ }).click();
    await page.locator(".notification-item").first().click();
    await page.waitForURL(/\/pantry/);
    await page.locator(".ui-notice", { hasText: "Thực phẩm này không còn trong kho" }).waitFor();
    check("Link thông báo từ trang Thực đơn mở đúng trang đích (/pantry?item=)", true);
    await ctx.close();
  }

  // 6) Trạng thái: chưa có thực đơn, đang tải, lỗi (giả lập phản hồi API).
  for (const w of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(after, AFTER, "/meal-plans", w, theme, (p) => p.route("**/api/meal-plans", (route) => route.fulfill({ json: [] })));
      await page.locator(".td-empty").waitFor();
      if (w === 1440 && theme === "light") {
        check("Chưa có thực đơn: EmptyState + ô ngày + Tạo thực đơn", (await page.locator(".td-empty .ui-empty__message").innerText()).startsWith("Bạn chưa có thực đơn nào")
          && (await page.locator(".td-empty").getByRole("button", { name: "Tạo thực đơn" }).count()) === 1);
      }
      await page.screenshot({ path: `${OUT}/thuc-don-trong_${w}_${themeName(theme)}.png`, fullPage: true });
      await ctx.close();
    }
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: after, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    let mode = "slow";
    await page.route("**/api/meal-plans", async (route) => {
      if (mode === "slow") { await new Promise((r) => setTimeout(r, 2500)); return route.continue(); }
      return route.fulfill({ status: 500, json: { message: "Lỗi thử" } });
    });
    page.goto(AFTER + "/meal-plans");
    await page.locator(".td-view .ui-loading").waitFor();
    check("Đang tải: skeleton đúng hình trang", (await page.locator(".td-view .ui-skeleton").count()) >= 10);
    await page.screenshot({ path: `${OUT}/thuc-don-dang-tai_1440_sang.png` });
    mode = "error";
    await page.waitForTimeout(3000);
    await page.reload();
    await page.locator(".td-view .ui-error").waitFor({ timeout: 20000 });
    check("Lỗi: ErrorState + Thử lại", (await page.getByRole("button", { name: "Thử lại" }).count()) === 1);
    await page.screenshot({ path: `${OUT}/thuc-don-loi_1440_sang.png` });
    await ctx.close();
  }

  // 7) Tương phản, Tab, phông, 320px.
  list = await plans();
  const current = list.find((p) => p.status === "ACTIVE") ?? list[0];
  for (const theme of ["light", "dark"]) {
    const { ctx, page } = await open(after, AFTER, `/meal-plans/${current.id}`, 1440, theme);
    await page.locator(".td-shop-item").first().click();
    await page.waitForTimeout(600);
    await page.locator(".td-meal__others").first().locator("summary").click();
    const pairs = await page.evaluate(`(${(fn) => {
      const sels = [".td-day[aria-selected='true'] .td-day__name", ".td-day:not([aria-selected='true']) .td-day__date", ".td-hero__dates", ".td-tag--active", ".td-hero__meta .ui-tag:not(.td-tag--active)",
        ".td-toolbar__label", ".td-meal__type", ".td-meal__facts", ".td-day-panel__title", ".td-week dt", ".td-suggestions li", ".td-shop-group__title", ".td-shop-item__qty",
        ".td-shop-item.is-bought .td-shop-item__name", ".td-other__meta", ".ui-ring__target", ".ui-macro__percent", ".td-create__source", ".td-meal__others summary"];
      return sels.flatMap((sel) => [...document.querySelectorAll(sel)].slice(0, 1).map((el) => [sel, Math.round(fn(el) * 100) / 100]));
    }})(${contrastOf.toString()})`);
    const weak = pairs.filter(([, r]) => r < 4.5);
    check(`Tương phản chữ ${theme}: ${pairs.length} cặp đều ≥ 4.5:1`, pairs.length >= 18 && weak.length === 0, (weak.length ? weak : pairs).map(([s, r]) => `${s}=${r}`).join(" "));
    await page.locator(".td-shop-item").first().click();
    await page.waitForTimeout(600);
    if (theme === "light") {
      await page.reload(); await page.waitForLoadState("networkidle");
      const hidden = []; let stops = 0;
      for (let i = 0; i < 90; i++) {
        await page.keyboard.press("Tab"); await page.waitForTimeout(60);
        const info = await page.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          return { name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30), main: Boolean(el.closest("#noi-dung-chinh")),
            visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
        });
        if (!info) break;
        if (info.main && !info.visible) {
          await page.waitForTimeout(250);
          info.visible = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== ""); });
        }
        if (info.main) { stops++; if (!info.visible) hidden.push(info.name); }
      }
      check(`Tab ${stops} điểm dừng trong nội dung đều thấy focus`, stops >= 30 && hidden.length === 0, hidden.slice(0, 5).join(" | "));
      const client = await ctx.newCDPSession(page);
      await client.send("DOM.enable"); await client.send("CSS.enable");
      const { root } = await client.send("DOM.getDocument", { depth: -1 });
      const issues = [];
      for (const selector of ["h1", "h1 em", ".td-day-panel__title", ".td-card__title", ".ui-ring__number"]) {
        const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: `#noi-dung-chinh ${selector}` });
        for (const nodeId of nodeIds) {
          const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
          if (!fonts.every((f) => /Fraunces|Be Vietnam Pro/.test(f.familyName) && f.isCustomFont)) issues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
        }
      }
      check("Tiêu đề (dấu chồng: Thực đơn, Thứ Hai, Dinh dưỡng trong ngày, Gợi ý cho tuần này, Đi chợ) vẽ bằng phông đã nạp", issues.length === 0, issues.join("; "));
      await page.setViewportSize({ width: 320, height: 800 });
      await page.waitForTimeout(300);
      check("320px không cuộn ngang", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
    }
    await ctx.close();
  }

  // 8) Dọn: xóa mọi thực đơn của demo (đầu lượt demo không có thực đơn nào).
  for (const p of await plans()) await call("DELETE", `/meal-plans/${p.id}`);
  check("Dọn dữ liệu thử: demo không còn thực đơn nào (như ban đầu)", (await plans()).length === 0);
  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
