// Nghiệm thu UI-11 (Landing). node ui11-check.cjs <thư mục ảnh docs>
// Khách chưa đăng nhập; tài khoản demo chỉ dùng để thử "đăng nhập rồi quay lại món" và bản đã đăng nhập. Không đổi dữ liệu.
const ACC = require("./lib/env.cjs");
const fs = require("fs");
const { chromium } = require("playwright-core");
const [OUT] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const DEMO = { email: ACC.demo().email, password: ACC.demo().password };
const PHOTO_FILE = ACC.FIXTURES + "/thu-2.jpg";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
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
  const stats = await (await fetch(`${API}/recipes/stats`)).json();
  const featured = await (await fetch(`${API}/recipes/featured?limit=7`)).json();
  const demoToken = (await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(DEMO) })).json()).token;
  const visibleIds = new Set((await (await fetch(`${API}/recipes`, { headers: { Authorization: `Bearer ${demoToken}` } })).json()).map((r) => r.id));

  const open = async (path, w, theme = "light", { state, setup, reducedMotion = "reduce", wait = true } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    if (setup) await setup(page);
    await page.goto(APP + path);
    if (!wait) return { ctx, page };
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    return { ctx, page };
  };
  const themeName = (t) => (t === "light" ? "sang" : "toi");
  const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  // Giả lập món có ảnh thật (không đổi dữ liệu): 3 món đầu mang URL Cloudinary, ảnh trả từ file thử.
  const withPhotos = async (page) => {
    await page.route("**/api/recipes/featured**", async (route) => {
      const res = await route.fetch(); const json = await res.json();
      json.slice(0, 3).forEach((r, i) => { r.imageUrl = `https://res.cloudinary.com/demo/image/upload/v1/nouri/recipes/thu-${i}.jpg`; });
      return route.fulfill({ response: res, json });
    });
    await page.route("https://res.cloudinary.com/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: fs.readFileSync(PHOTO_FILE) }));
  };

  // 1) Ảnh 390/768/1440/1920 sáng/tối (khách, dữ liệu thật: chưa có ảnh món).
  for (const w of [390, 768, 1440, 1920]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open("/", w, theme);
      await page.screenshot({ path: `${OUT}/landing_${w}_${themeName(theme)}.png`, fullPage: true });
      const info = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, mains: document.querySelectorAll("main").length, h1: document.querySelectorAll("h1").length,
        bg: getComputedStyle(document.body).backgroundColor }));
      check(`Landing ${w}px ${theme}: theo chế độ đã chọn, một <main>/<h1>, không cuộn ngang`, info.theme === theme && info.mains === 1 && info.h1 === 1 && (await noOverflow(page)) <= 0, info.bg);
      await ctx.close();
    }
  }
  // Có ảnh món thật (giả lập).
  for (const [w, theme] of [[1440, "light"], [1440, "dark"], [390, "light"]]) {
    const { ctx, page } = await open("/", w, theme, { setup: withPhotos });
    await page.locator(".ld-hero__image").waitFor({ timeout: 5000 }).catch(() => {});
    await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/landing-co-anh_${w}_${themeName(theme)}.png`, fullPage: true });
    if (w === 1440 && theme === "light") {
      const hero = await page.locator(".ld-hero__image").getAttribute("src");
      const cards = await page.locator(".ld-recipe").evaluateAll((els) => els.map((e) => e.querySelector(".ld-recipe__title").textContent));
      const big = await page.locator(".ld-recipes > li").first().evaluate((li) => li.getBoundingClientRect().width / li.nextElementSibling.getBoundingClientRect().width);
      check("Có ảnh thật: hero dùng ảnh món (w_1200), món của hero không lặp ở thẻ, thẻ đầu có ảnh lớn gấp đôi, 6 thẻ",
        /w_1200/.test(hero) && !cards.includes(featured[0].name) && cards.length === 6 && big > 1.9, `${cards.length} thẻ, tỉ lệ ${big.toFixed(2)}`);
    }
    check(`Có ảnh ${w}px ${theme}: không cuộn ngang`, (await noOverflow(page)) <= 0);
    await ctx.close();
  }

  // 2) Nội dung: số thật, món thật, không số giả, không hiệu ứng.
  {
    const { ctx, page } = await open("/", 1440, "light", { reducedMotion: "no-preference" });
    const text = await page.locator("main").innerText();
    const counts = await page.locator(".ld-groups__count").allTextContents();
    check("Số nhóm món khớp /api/recipes/stats", JSON.stringify(counts.map((c) => Number(c.replace(/\D/g, "")))) === JSON.stringify([stats.breakfast, stats.vegetarian, stats.vegan, stats.lowCarb, stats.highProtein])
      && text.includes(`Nouri đang có ${stats.total} món`), counts.join(","));
    const cards = await page.locator(".ld-recipe__title").allTextContents();
    const expected = featured.slice(0, 6).map((r) => r.name);
    check("6 thẻ món đúng thứ tự /api/recipes/featured, đều là món đang hiện", JSON.stringify(cards.map((c) => c.replace(", đăng nhập để xem công thức", ""))) === JSON.stringify(expected)
      && featured.every((r) => visibleIds.has(r.id)), cards.join(" | "));
    check("Không ô xám lớn khi chưa có ảnh: không có ô RecipeImage trống, hero chỉ có chữ", (await page.locator(".ui-recipe-image--empty").count()) === 0 && (await page.locator(".ld-hero__figure").count()) === 0);
    check("Không số minh họa / câu quảng cáo / tiếng Anh", !/thành viên tích cực|\d+[.,]\d{3}\s|\d+K\+|tuyệt vời|thông minh|hành trình|khám phá ngay|healthy|eat clean|low carb/i.test(text));
    const deco = await page.evaluate(() => {
      const all = [...document.querySelectorAll("body *")];
      return {
        animations: document.getAnimations().length,
        gradient: all.filter((e) => /gradient/.test(getComputedStyle(e).backgroundImage)).length,
        blur: all.filter((e) => getComputedStyle(e).backdropFilter !== "none").length,
        legacy: document.querySelectorAll("[class*='landing-']").length,
        emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u.test(document.body.innerText),
        arrow: document.body.innerText.includes("→"),
        italic: [...document.querySelectorAll("main em, main i")].filter((e) => getComputedStyle(e).fontStyle === "italic").map((e) => e.closest("h1") ? "h1" : e.tagName),
      };
    });
    check("Không gradient, kính mờ, emoji, \"→\", lớp landing-* cũ; không animation tự chạy (kể cả khi không giảm chuyển động)",
      deco.animations === 0 && deco.gradient === 0 && deco.blur === 0 && deco.legacy === 0 && !deco.emoji && !deco.arrow, JSON.stringify(deco));
    check("Chữ nghiêng accent chỉ một cụm, trong H1", JSON.stringify(deco.italic) === JSON.stringify(["h1"]));
    const scripts = await page.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).filter((n) => /gsap/i.test(n)));
    check("Không tải GSAP", scripts.length === 0, scripts.join(","));
    const steps = await page.locator(".ld-step__title").allTextContents();
    check("Cách hoạt động: 4 bước đánh số đúng thứ tự (kho, hồ sơ, thực đơn, đi chợ) trong <ol>", (await page.locator("ol.ld-steps > li").count()) === 4
      && /kho/.test(steps[0]) && /hồ sơ/.test(steps[1]) && /thực đơn/.test(steps[2]) && /chợ/.test(steps[3]));
    check("Nouri giúp gì: 3 việc, không icon trang trí", (await page.locator(".ld-benefit").count()) === 3 && (await page.locator("#nouri-giup-gi svg").count()) === 0);
    const primaries = await page.evaluate(() => [...document.querySelectorAll(".ui-button--primary")].map((b) => b.closest("section, header")?.className));
    check("Mỗi vùng tối đa 1 nút chính", new Set(primaries).size === primaries.length, primaries.join(" | "));
    await ctx.close();
  }

  // 3) Trạng thái: đang tải, lỗi + Thử lại, thiếu số liệu.
  {
    const { ctx, page } = await open("/", 1440, "light", { wait: false, setup: (p) => p.route("**/api/recipes/featured**", async (route) => { await new Promise((r) => setTimeout(r, 8000)); await route.continue().catch(() => {}); }) });
    await page.locator(".ld-recipes[aria-busy='true']").waitFor({ timeout: 6000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    check("Đang tải món: skeleton", (await page.locator(".ld-recipes[aria-busy='true'] .ui-skeleton").count()) === 3);
    await page.locator("#mon-an").screenshot({ path: `${OUT}/mon-dang-tai_1440_sang.png` });
    await ctx.close();
  }
  {
    let fail = true;
    const { ctx, page } = await open("/", 1440, "light", { setup: (p) => p.route("**/api/recipes/**", (route) => (fail ? route.fulfill({ status: 500, json: { message: "Lỗi" } }) : route.continue())) });
    await page.getByRole("button", { name: "Thử lại" }).waitFor({ timeout: 15000 }).catch(() => {});
    const intro = await page.locator("#mon-an .ld-text").first().innerText();
    check("API lỗi: báo lỗi + Thử lại, ẩn số nhóm, câu dẫn không có số", (await page.getByRole("button", { name: "Thử lại" }).count()) === 1
      && (await page.locator(".ld-groups").count()) === 0 && !/\d/.test(intro), intro);
    await page.locator("#mon-an").screenshot({ path: `${OUT}/mon-loi_1440_sang.png` });
    fail = false;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await page.locator(".ld-recipe").first().waitFor({ timeout: 10000 }).catch(() => {});
    check("Thử lại: tải được món", (await page.locator(".ld-recipe").count()) === 6);
    await ctx.close();
  }

  // 4) Luồng khách: neo, menu thu gọn, đăng ký, bấm món → đăng nhập → mở đúng món.
  {
    const { ctx, page } = await open("/", 1440);
    await page.locator(".site-nav").getByRole("link", { name: "Cách hoạt động" }).click();
    await page.waitForTimeout(400);
    const pos = await page.evaluate(() => ({ heading: document.getElementById("ld-steps-title").getBoundingClientRect().top, header: document.querySelector(".site-header").getBoundingClientRect().bottom, hash: location.hash }));
    check("Neo \"Cách hoạt động\": tới đúng phần, tiêu đề không bị menu che", pos.hash === "#cach-hoat-dong" && pos.heading >= pos.header && pos.heading < 300, JSON.stringify(pos));
    await page.locator(".ld-hero").getByRole("link", { name: "Đăng ký miễn phí" }).click();
    await page.waitForURL("**/login?mode=register");
    await page.getByRole("button", { name: "Tạo tài khoản" }).waitFor({ timeout: 5000 }).catch(() => {});
    check("\"Đăng ký miễn phí\" mở sẵn form đăng ký", (await page.getByLabel("Họ và tên").count() + await page.getByLabel("Tên").count()) >= 1 && (await page.getByRole("button", { name: "Tạo tài khoản" }).count() + await page.getByRole("button", { name: "Đăng ký", exact: true }).count()) >= 1);
    await ctx.close();
  }
  {
    const { ctx, page } = await open("/", 390);
    check("390px: liên kết neo thu vào nút menu", !(await page.locator(".site-nav").isVisible()) && await page.getByRole("button", { name: "Các phần của trang" }).isVisible());
    await page.getByRole("button", { name: "Các phần của trang" }).click();
    await page.screenshot({ path: `${OUT}/menu-mo_390_sang.png` });
    const links = await page.locator(".site-mobile-nav a").allTextContents();
    await page.keyboard.press("Escape");
    check("Menu thu gọn: 4 liên kết neo, Esc đóng và trả focus", links.length === 4 && await page.locator(".site-mobile-nav").isHidden()
      && (await page.evaluate(() => document.activeElement.getAttribute("aria-label"))) === "Các phần của trang");
    await page.getByRole("button", { name: "Các phần của trang" }).click();
    await page.locator(".site-mobile-nav").getByRole("link", { name: "Món ăn" }).click();
    await page.waitForTimeout(400);
    check("Bấm neo trong menu: menu đóng, tới phần Món ăn", await page.locator(".site-mobile-nav").isHidden() && (await page.evaluate(() => location.hash)) === "#mon-an");
    await ctx.close();
  }
  {
    const target = featured[0];
    const { ctx, page } = await open("/", 1440);
    const link = page.locator(".ld-recipe__link").first();
    check("Thẻ món của khách: tên đọc có \"đăng nhập để xem công thức\", dẫn tới /login?next=", (await link.innerText()).includes(target.name)
      && (await link.getAttribute("href")) === `/login?next=${encodeURIComponent(`/recipes/${target.id}`)}`);
    await page.locator(".ld-recipe").first().scrollIntoViewIfNeeded();
    const box = await page.locator(".ld-recipe").first().boundingBox();
    await page.mouse.click(box.x + box.width - 12, box.y + box.height - 12);
    await page.waitForURL("**/login?next=*");
    await page.getByLabel("Email").fill(DEMO.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(DEMO.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL(`**/recipes/${target.id}`, { timeout: 15000 }).catch(() => {});
    check("Bấm vào góc thẻ (cả thẻ là vùng bấm) → đăng nhập → mở đúng món", new URL(page.url()).pathname === `/recipes/${target.id}`, page.url());
    const state = await ctx.storageState();
    await ctx.close();

    // Đã đăng nhập: nút "Về Tổng quan", thẻ mở thẳng chi tiết.
    const signed = await open("/", 1440, "light", { state });
    check("Đã đăng nhập: menu và hero có \"Về Tổng quan\", thẻ mở thẳng /recipes/:id", (await signed.page.getByRole("link", { name: "Về Tổng quan" }).count()) >= 2
      && (await signed.page.locator(".ld-recipe__link").first().getAttribute("href")) === `/recipes/${target.id}` && (await signed.page.getByRole("link", { name: "Đăng ký miễn phí" }).count()) === 0);
    await signed.page.screenshot({ path: `${OUT}/landing-da-dang-nhap_1440_sang.png` });
    await signed.ctx.close();
    const bad = await open(`/login?next=${encodeURIComponent("https://example.com")}`, 1440);
    await bad.page.getByLabel("Email").fill(DEMO.email);
    await bad.page.getByLabel("Mật khẩu", { exact: true }).fill(DEMO.password);
    await bad.page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await bad.page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
    check("?next= trỏ ra ngoài ứng dụng: bỏ qua, về /dashboard", new URL(bad.page.url()).pathname === "/dashboard");
    await bad.ctx.close();
  }

  // 5) Tương phản, Tab, phông (dấu chồng), 320px.
  for (const theme of ["light", "dark"]) {
    const { ctx, page } = await open("/", 1440, theme, { setup: withPhotos });
    const sels = [".ui-hero-title", ".ui-hero-title em", ".ld-hero__lead", ".ld-hero .ui-small", ".ui-button--primary", ".ui-button--secondary", ".site-nav__link", ".ui-section-title",
      ".ld-benefit__title", ".ld-text", ".ld-groups dt", ".ld-groups__count", ".ld-recipe__link", ".recipe-specs li", ".ui-tag", ".ld-step__number", ".ld-step__title", ".ld-recipes-foot .ui-small",
      ".ld-signup .ui-link", ".ld-hero__figure figcaption", ".site-footer__link"];
    const pairs = await page.evaluate(`(${(fn, list) => list.flatMap((sel) => [...document.querySelectorAll(sel)].slice(0, 1).map((el) => [sel, Math.round(fn(el) * 100) / 100]))})(${contrastOf.toString()}, ${JSON.stringify(sels)})`);
    const weak = pairs.filter(([, r]) => r < 4.5);
    check(`Tương phản chữ ${theme}: ${pairs.length} cặp ≥ 4.5:1`, pairs.length >= 18 && weak.length === 0, (weak.length ? weak : pairs).map(([s, r]) => `${s}=${r}`).join(" "));
    if (theme === "light") {
      const hidden = []; let stops = 0; const names = [];
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press("Tab"); await page.waitForTimeout(40);
        const info = await page.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          return { name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), footer: Boolean(el.closest("footer.site-footer")),
            visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
        });
        if (!info || info.footer) break;
        stops++; names.push(info.name); if (!info.visible) hidden.push(info.name);
      }
      check(`Tab ${stops} điểm dừng (bỏ qua menu, menu, hero, thẻ món…) đều thấy focus`, stops >= 15 && hidden.length === 0 && names[0].startsWith("Bỏ qua menu"), hidden.join(" | ") || names.slice(0, 8).join(" | "));
      const client = await ctx.newCDPSession(page);
      await client.send("DOM.enable"); await client.send("CSS.enable");
      const { root } = await client.send("DOM.getDocument", { depth: -1 });
      const issues = [];
      for (const [selector, family] of [["h1", "Fraunces"], ["h1 em", "Fraunces"], [".ui-section-title", "Fraunces"], [".ld-groups__count", "Fraunces"], [".ld-step__number", "Fraunces"],
        [".ld-hero__lead", "Be Vietnam Pro"], [".ld-benefit__title", "Be Vietnam Pro"], [".ld-text", "Be Vietnam Pro"], [".ld-step__title", "Be Vietnam Pro"], [".ld-recipe__link", "Be Vietnam Pro"]]) {
        const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
        for (const nodeId of nodeIds.slice(0, 4)) {
          const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
          if (!fonts.every((f) => f.familyName.includes(family) && f.isCustomFont)) issues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
        }
      }
      check("Dấu chồng (Biết tủ bếp còn gì, tuần này ăn gì; Nouri giúp gì; Cách hoạt động; Đi chợ…): tiêu đề Fraunces, chữ thân Be Vietnam Pro", issues.length === 0, issues.join("; "));
    }
    await ctx.close();
  }
  for (const [label, setup] of [["chưa có ảnh", undefined], ["có ảnh", withPhotos]]) {
    const { ctx, page } = await open("/", 320, "light", { setup });
    check(`320px (${label}): không cuộn ngang`, (await noOverflow(page)) <= 0);
    await ctx.close();
  }

  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
