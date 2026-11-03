// Nghiệm thu UI-3 (Tổng quan). node ui3-check.cjs <thư mục ảnh docs>
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const OUT = process.argv[2];
const BASE = "http://localhost:5173";
const API = "http://localhost:4000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const json = async (method, path, token, body) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

async function sessionFor(browser, email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('input[type="password"]').press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const demoToken = (await json("POST", "/auth/login", null, { email: ACC.demo().email, password: ACC.demo().password })).body.token;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const plan = await json("POST", "/meal-plans/generate", demoToken, { startDate: today });
  check("Tạo thực đơn thử cho demo (bắt đầu hôm nay)", plan.status === 201 || plan.status === 200, `${plan.status} ${plan.body?.id ?? JSON.stringify(plan.body).slice(0, 80)}`);
  const planId = plan.body?.id;
  const activated = await json("PATCH", `/meal-plans/${planId}/status`, demoToken, { status: "ACTIVE" });
  check("Kích hoạt thực đơn thử (ACTIVE)", activated.status === 200, String(activated.status));
  const demo = await sessionFor(browser, ACC.demo().email, ACC.demo().password);

  const open = async (state, w, theme = "light", { reduced = true, route } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion: reduced ? "reduce" : "no-preference" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of 401|status of 503|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    if (route) await route(page);
    await page.goto(BASE + "/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    return { ctx, page };
  };

  // 1) Ảnh sau: 390 / 1440 × sáng / tối (có thực đơn hôm nay).
  for (const theme of ["light", "dark"]) {
    for (const w of [390, 1440]) {
      const { ctx, page } = await open(demo, w, theme);
      await page.screenshot({ path: `${OUT}/dashboard_${w}_sau_${theme === "light" ? "sang" : "toi"}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(`${w}px ${theme}: không cuộn ngang`, overflow <= 0, `${overflow}px`);
      check(`${w}px ${theme}: nội dung đổi theo chế độ (main không cố định sáng)`, (await page.locator("#noi-dung-chinh").getAttribute("data-theme")) === null);
      await ctx.close();
    }
  }

  // 2) Nội dung và chức năng.
  {
    const { ctx, page } = await open(demo, 1440);
    const h1 = await page.locator("h1").innerText();
    check("H1 'Hôm nay nấu gì?', cụm 'nấu gì?' nghiêng màu accent", h1.replace(/\s+/g, " ") === "Hôm nay nấu gì?"
      && (await page.locator("h1 em").evaluate((el) => getComputedStyle(el).fontStyle)) === "italic");
    const greet = await page.locator(".dash-hero__greeting").innerText();
    check("Lời chào theo giờ kèm tên", /^Chào buổi (sáng|trưa|chiều|tối), Minh Anh$/.test(greet), greet);
    const dish1 = await page.locator(".dash-hero__dish strong").innerText();
    const heroImg = await page.locator(".dash-hero__image").evaluate((img) => ({ ok: img.complete && img.naturalWidth > 0, alt: img.alt }));
    check("Hero có món gợi ý + ảnh món (có alt)", Boolean(dish1) && heroImg.ok && heroImg.alt.includes(dish1), `${dish1} | ${heroImg.alt}`);
    await page.getByRole("button", { name: "Đổi món khác" }).click();
    const dish2 = await page.locator(".dash-hero__dish strong").innerText();
    check("Đổi món khác → món gợi ý khác", dish2 !== dish1, `${dish1} → ${dish2}`);

    const mealsBefore = await page.locator(".dash-meal").count();
    const types = await page.locator(".dash-meal__type > span:first-child").allInnerTexts();
    check("Thực đơn hôm nay: các bữa theo thứ tự trong ngày", mealsBefore >= 3 && JSON.stringify(types) === JSON.stringify([...types].sort((a, b) => ["Bữa sáng", "Bữa trưa", "Bữa phụ", "Bữa tối"].indexOf(a) - ["Bữa sáng", "Bữa trưa", "Bữa phụ", "Bữa tối"].indexOf(b))), types.join(", "));
    const nameLinks = await page.locator(".dash-meal__name").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    check("Tên món link sang chi tiết", nameLinks.every((href) => /^\/recipes\/[a-z0-9]+$/.test(href)));
    check("Chỉ một nút 'Đã ăn' ở bữa kế tiếp", (await page.locator(".dash-meal button", { hasText: "Đã ăn" }).count()) === 1 && (await page.locator(".dash-meal.is-next").count()) === 1);
    const ringLabelBefore = await page.locator(".dash-ring").getAttribute("aria-label");
    const nextName = await page.locator(".dash-meal.is-next .dash-meal__name").innerText();
    await page.locator(".dash-meal.is-next button").click();
    await page.locator(".dash-status").waitFor();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    const ringLabelAfter = await page.locator(".dash-ring").getAttribute("aria-label");
    const macros = await page.locator(".dash-macro dd > span:first-child").allInnerTexts();
    check("Đã ăn → thông báo, vòng calo tăng, đạm/tinh bột/béo có số thật", (await page.locator(".dash-status").innerText()).includes(`Đã đánh dấu đã ăn: ${nextName}`)
      && ringLabelAfter !== ringLabelBefore && macros.some((m) => !m.startsWith("0 /")), `${ringLabelBefore} → ${ringLabelAfter}; ${macros.join(" | ")}`);
    await page.screenshot({ path: `${OUT}/dashboard_1440_da-an.png` });
    const nextAfter = await page.locator(".dash-meal.is-next .dash-meal__name").innerText().catch(() => "(hết bữa)");
    check("Bữa kế tiếp chuyển sang bữa sau", nextAfter !== nextName, `${nextName} → ${nextAfter}`);
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    check("Hoàn tác → bỏ đánh dấu, vòng calo về như cũ", (await page.locator(".dash-ring").getAttribute("aria-label")) === ringLabelBefore
      && (await page.locator(".dash-status").innerText()).includes("Đã bỏ đánh dấu"));

    const pantryStats = await page.locator(".dash-stat dd").allInnerTexts();
    const soon = await page.locator(".dash-soon__days").allInnerTexts();
    check("Tủ bếp: số liệu thật, món cần dùng sớm kèm số ngày, không có nút Quét hóa đơn",
      pantryStats.length === 2 && soon.every((t) => /Còn \d+ ngày|Hết hạn hôm nay/.test(t)) && !(await page.getByText("Quét hóa đơn").count()), `${pantryStats.join(" / ")}; ${soon.join(", ")}`);
    const soonHref = await page.locator(".dash-soon__item").first().getAttribute("href");
    check("Món cần dùng sớm mở đúng dòng trong Kho (?item=)", /^\/pantry\?item=/.test(soonHref ?? ""), soonHref);
    const tags = await page.locator(".dash-rec .ui-tag").allInnerTexts();
    check("Nhãn món tiếng Việt, không in hoa tiếng Anh", tags.length > 0 && tags.every((t) => ["Ít tinh bột", "Giàu đạm", "Món chay", "Thuần chay"].includes(t)), tags.join(", "));
    check("Thẻ gợi ý đầu lớn hơn các thẻ còn lại", await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".dash-rec")].map((el) => el.getBoundingClientRect().width);
      return cards.length > 1 && cards.slice(1).every((w) => cards[0] > w);
    }));
    const text = await page.locator("#noi-dung-chinh").innerText();
    check("Không có '·' nối chuỗi, '→', 'Low Carb', 'HIGH PROTEIN'", !/[·→]|Low Carb|HIGH PROTEIN|LOW CARB/.test(text));
    await page.locator(".dash-water button").click();
    check("Lượng nước: thêm 1 ly (khối phụ)", (await page.locator(".dash-water").innerText()).includes("0,25 / 2 lít"));
    await page.locator("#dash-search").fill("ức gà");
    await page.locator("#dash-search").press("Enter");
    await page.waitForURL("**/recipes?q=*");
    check("Ô tìm công thức vẫn chuyển sang /recipes?q=", decodeURIComponent(page.url()).includes("q=ức gà"));
    await ctx.close();
  }

  // 3) Vòng calo: chuyển động khi tải (không reduced-motion) và tắt khi reduced-motion.
  {
    let { ctx, page } = await open(demo, 1440, "light", { reduced: false });
    const motion = await page.locator(".dash-ring__value").evaluate((el) => getComputedStyle(el).transitionDuration);
    await ctx.close();
    ({ ctx, page } = await open(demo, 1440, "light", { reduced: true }));
    const reduced = await page.locator(".dash-ring__value").evaluate((el) => getComputedStyle(el).transitionDuration);
    check("Vòng calo chạy tới giá trị (0.9s), tắt khi prefers-reduced-motion", motion === "0.9s" && parseFloat(reduced) < 0.001, `${motion} / ${reduced}`);
    const others = await page.evaluate(() => [...document.querySelectorAll("#noi-dung-chinh *")].filter((el) => getComputedStyle(el).animationName !== "none").length);
    check("Không có animation tự chạy nào khác trên trang", others === 0, `${others}`);
    // Phông tiêu đề: dấu chồng ở H1/H2 vẽ bằng Fraunces.
    const client = await ctx.newCDPSession(page);
    await client.send("DOM.enable"); await client.send("CSS.enable");
    const { root } = await client.send("DOM.getDocument", { depth: -1 });
    const fontIssues = [];
    for (const selector of ["#dash-hero-title", "#dash-hero-title em", "#dash-nutrition-title", "#dash-meals-title", "#dash-pantry-title", "#dash-recs-title"]) {
      const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
      for (const nodeId of nodeIds) {
        const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
        if (!fonts.every((f) => /Fraunces/.test(f.familyName) && f.isCustomFont)) fontIssues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
      }
    }
    check("Tiêu đề (có dấu chồng) vẽ bằng Fraunces", fontIssues.length === 0, fontIssues.join("; "));
    // Tab qua trang: mọi điểm dừng thấy focus.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.reload(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(300);
    const hidden = []; let stops = 0;
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press("Tab"); await page.waitForTimeout(40);
      const info = await page.evaluate(() => {
        const el = document.activeElement; if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return { name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30), main: Boolean(el.closest("#noi-dung-chinh")),
          visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
      });
      if (!info) break;
      if (info.main) { stops++; if (!info.visible) hidden.push(info.name); }
    }
    check(`Tab trong nội dung: ${stops} điểm dừng đều thấy focus`, stops >= 10 && hidden.length === 0, hidden.join(" | "));
    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(300);
    const over = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 0.5 && r.width > 0; })
      .slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} right=${Math.round(el.getBoundingClientRect().right)}`).join(", ") + ` | scrollW=${document.documentElement.scrollWidth}`);
    check("320px: không cuộn ngang", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, over);
    await ctx.close();
  }

  // 4) Đang tải (skeleton) và lỗi API (Thử lại).
  {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: demo });
    const page = await ctx.newPage();
    await page.route("**/api/dashboard", async (route) => { await gate; await route.continue(); });
    await page.goto(BASE + "/dashboard");
    await page.locator(".dash-page[role=status]").waitFor();
    await page.screenshot({ path: `${OUT}/dashboard_1440_dang-tai.png` });
    check("Đang tải: skeleton đúng hình trang", (await page.locator(".dash-page[role=status] .ui-skeleton").count()) >= 6);
    release();
    await page.locator(".dash-hero__greeting").waitFor();
    await page.unroute("**/api/dashboard");
    let fail = true;
    await page.route("**/api/dashboard", (route) => (fail ? route.fulfill({ status: 500, body: "{}" }) : route.continue()));
    await page.reload();
    await page.locator(".ui-error").waitFor({ timeout: 20000 });
    await page.screenshot({ path: `${OUT}/dashboard_1440_loi.png` });
    check("Lỗi API: ErrorState có nút Thử lại", (await page.locator(".ui-error").innerText()).includes("Chưa tải được dữ liệu Tổng quan") && (await page.getByRole("button", { name: "Thử lại" }).count()) === 1);
    fail = false;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await page.locator(".dash-hero__greeting").waitFor({ timeout: 20000 });
    check("Thử lại → tải được trang", true);
    await ctx.close();
  }

  // 5) Trạng thái trống: tài khoản mới (chưa có hồ sơ, kho trống, chưa có thực đơn).
  const email = `thu-ui3-${Date.now()}@nouri.vn`;
  const reg = await json("POST", "/auth/register", null, { name: "Người dùng thử", email, password: ACC.testPassword });
  check("Tạo tài khoản thử cho trạng thái trống", reg.status === 201, String(reg.status));
  if (reg.status === 201) {
    const fresh = await sessionFor(browser, email, ACC.testPassword);
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(fresh, 390, theme);
      if (theme === "light") {
        const empties = await page.locator(".ui-empty").allInnerTexts();
        const actions = await page.locator(".ui-empty a").evaluateAll((as) => as.map((a) => `${a.textContent}→${a.getAttribute("href")}`));
        check("Chưa có hồ sơ / chưa có thực đơn / kho trống → EmptyState mỗi khối một hành động",
          actions.includes("Tạo hồ sơ→/profile") && actions.includes("Tạo thực đơn→/meal-plans") && actions.includes("Thêm thực phẩm→/pantry"), actions.join(", "));
      }
      await page.screenshot({ path: `${OUT}/dashboard_390_trong_${theme === "light" ? "sang" : "toi"}.png`, fullPage: true });
      await ctx.close();
    }
  }
  console.log("EMAIL_THU=" + email);
  console.log("PLAN_THU=" + planId);

  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
