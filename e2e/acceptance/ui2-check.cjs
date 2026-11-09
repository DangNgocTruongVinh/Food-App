// Nghiệm thu UI-2 (khung chung). node ui2-check.cjs <thư mục ảnh docs> <thư mục ảnh tạm> <đường dẫn .env>
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const fs = require("fs");
const [DOCS, TMP, ENV] = process.argv.slice(2);
const env = Object.fromEntries(fs.readFileSync(ENV, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]));
const AFTER = "http://localhost:5173";
const BEFORE = "http://localhost:8080";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const PAGES = ["/dashboard", "/pantry", "/meal-plans", "/recipes", "/community", "/assistant", "/profile"];

async function loginState(browser, base, email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(base + "/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('input[type="password"]').press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const demoAfter = await loginState(browser, AFTER, ACC.demo().email, ACC.demo().password);
  const demoBefore = await loginState(browser, BEFORE, ACC.demo().email, ACC.demo().password);
  const adminAfter = await loginState(browser, AFTER, env.ADMIN_EMAIL, env.ADMIN_PASSWORD);

  const open = async (state, base, path, w, theme = "light", h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(`${path}: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`${path}: ${e}`));
    page.on("response", (r) => r.status() === 401 && errors.push(`401 ${r.request().method()} ${new URL(r.url()).pathname} (trang ${page.url()})`));
    await page.goto(base + path);
    await settle(page);
    return { ctx, page };
  };

  // 1) Trước / sau: Tổng quan và Kho, 390 / 1440 (khung cũ chỉ có chế độ sáng).
  for (const path of ["/dashboard", "/pantry"]) {
    const name = path.slice(1);
    for (const w of [390, 1440]) {
      let { ctx, page } = await open(demoBefore, BEFORE, path, w);
      await page.screenshot({ path: `${DOCS}/${name}_${w}_truoc.png` });
      await ctx.close();
      for (const theme of ["light", "dark"]) {
        ({ ctx, page } = await open(demoAfter, AFTER, path, w, theme));
        await page.screenshot({ path: `${DOCS}/${name}_${w}_sau_${theme === "light" ? "sang" : "toi"}.png` });
        await ctx.close();
      }
    }
  }

  // 2) Các trang cũ trong khung mới: tải được, không cuộn ngang ở 320 / 390 / 1440; ảnh toàn trang để xem lại.
  for (const path of PAGES) {
    for (const w of [320, 390, 1440]) {
      const { ctx, page } = await open(demoAfter, AFTER, path, w);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const mainText = (await page.locator("#noi-dung-chinh").innerText()).trim().length;
      const legacy = await page.locator("#noi-dung-chinh").getAttribute("data-theme");
      check(`${path} ${w}px: có nội dung, không cuộn ngang, nội dung cố định sáng`, overflow <= 0 && mainText > 50 && legacy === "light", `cuộn ${overflow}px, ${mainText} ký tự`);
      if (w !== 320) await page.screenshot({ path: `${TMP}/${path.slice(1)}_${w}.png`, fullPage: true });
      await ctx.close();
    }
  }

  // 3) Menu ≤ 1200px: bàn phím, Esc, đóng khi chuyển trang.
  {
    const { ctx, page } = await open(demoAfter, AFTER, "/dashboard", 1440);
    check("1440px: nhóm liên kết hiện, nút Menu ẩn", await page.locator(".site-nav").isVisible() && !(await page.locator(".site-header__menu-button").isVisible()));
    const active = await page.locator(".site-nav .is-active").textContent();
    check("Mục đang chọn đúng trang (Tổng quan)", active === "Tổng quan" && (await page.locator(".site-nav .is-active").getAttribute("aria-current")) === "page");
    await page.setViewportSize({ width: 1200, height: 900 });
    check("1200px: nhóm liên kết ẩn, nút Menu hiện", !(await page.locator(".site-nav").isVisible()) && await page.locator(".site-header__menu-button").isVisible());
    const button = page.locator(".site-header__menu-button");
    await button.focus();
    await page.keyboard.press("Enter");
    check("Enter mở menu: aria-expanded=true, danh sách hiện", (await button.getAttribute("aria-expanded")) === "true" && await page.locator(".site-mobile-nav").isVisible());
    await page.screenshot({ path: `${DOCS}/menu-thu-gon_1200_sang.png` });
    await page.keyboard.press("Tab");
    const firstLink = await page.evaluate(() => document.activeElement?.textContent);
    check("Tab đi tiếp vào liên kết đầu của menu", firstLink === "Tổng quan", firstLink);
    await page.keyboard.press("Escape");
    check("Esc đóng menu và trả focus về nút Menu", !(await page.locator(".site-mobile-nav").isVisible())
      && (await page.evaluate(() => document.activeElement?.classList.contains("site-header__menu-button"))));
    await button.click();
    await page.locator(".site-mobile-nav a", { hasText: "Kho thực phẩm" }).click();
    await page.waitForURL("**/pantry");
    check("Chọn liên kết → chuyển trang và menu tự đóng", !(await page.locator(".site-mobile-nav").isVisible()));
    await ctx.close();
  }

  // 4) Menu tài khoản theo vai trò; /admin.
  {
    let { ctx, page } = await open(demoAfter, AFTER, "/dashboard", 1440);
    const acc = page.locator(".account-menu__button");
    await acc.click();
    const items = await page.locator(".account-menu__item").allTextContents();
    check("USER: menu tài khoản gồm Hồ sơ, Đăng xuất (không có Quản trị)", JSON.stringify(items) === '["Hồ sơ","Đăng xuất"]', items.join(", "));
    await page.screenshot({ path: `${DOCS}/menu-tai-khoan_1440_sang.png` });
    await page.keyboard.press("Escape");
    check("Esc đóng menu tài khoản, focus về nút", !(await page.locator(".account-menu__panel").isVisible()) && (await page.evaluate(() => document.activeElement?.classList.contains("account-menu__button"))));
    await page.goto(AFTER + "/admin");
    await page.waitForURL("**/dashboard");
    check("USER vào /admin → chuyển về /dashboard", page.url().endsWith("/dashboard"));
    await acc.click();
    await page.locator(".account-menu__item", { hasText: "Đăng xuất" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/dashboard"));
    check("Đăng xuất từ menu tài khoản", (await page.evaluate(() => localStorage.getItem("nouri_token") ?? sessionStorage.getItem("nouri_token"))) === null, page.url());
    await ctx.close();

    for (const theme of ["light", "dark"]) {
      for (const w of [390, 1440]) {
        ({ ctx, page } = await open(adminAfter, AFTER, "/admin", w, theme));
        if (theme === "light" && w === 1440) {
          await page.locator(".account-menu__button").click();
          const adminItems = await page.locator(".account-menu__item").allTextContents();
          check("ADMIN: menu có Quản trị, /admin hiện trang đang xây dựng", adminItems.includes("Quản trị") && (await page.locator("h1").textContent()) === "Quản trị");
          await page.keyboard.press("Escape");
        }
        check(`/admin ${w}px ${theme}: nội dung đổi theo chế độ (không cố định sáng)`, (await page.locator("#noi-dung-chinh").getAttribute("data-theme")) === null);
        await page.screenshot({ path: `${DOCS}/admin_${w}_${theme === "light" ? "sang" : "toi"}.png`, fullPage: true });
        await ctx.close();
      }
    }
  }

  // 5) Chuông thông báo: chấm, tên đọc, danh sách thả, bảng đầy đủ (dialog).
  {
    const { ctx, page } = await open(demoAfter, AFTER, "/dashboard", 1440, "dark");
    const bell = page.locator(".notification-bell");
    const label = await bell.getAttribute("aria-label");
    const dot = await page.locator(".notification-dot").count();
    check("Chuông: tên đọc nói số chưa đọc nếu có, chấm --dot không chứa chữ", label.startsWith("Thông báo") && (dot === 0 || /chưa đọc/.test(label)), `${label}; chấm: ${dot}`);
    await bell.click();
    await page.locator(".notification-dropdown").waitFor();
    await settle(page);
    await page.screenshot({ path: `${DOCS}/thong-bao_1440_toi.png` });
    check("Không còn mũi tên → trong danh sách thông báo", !(await page.locator(".notification-dropdown").innerText()).includes("→"));
    await page.keyboard.press("Escape");
    check("Esc đóng danh sách, focus về chuông", !(await page.locator(".notification-dropdown").count()) && (await page.evaluate(() => document.activeElement?.classList.contains("notification-bell"))));
    await bell.click();
    await page.locator(".notification-view-all").click();
    const drawer = page.locator("dialog.notification-drawer");
    check("Xem tất cả → mở <dialog> thông báo", await drawer.evaluate((d) => d.open));
    const inside = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); inside.push(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")) || document.activeElement === document.body)); }
    check("Tab không ra khỏi bảng thông báo", inside.every(Boolean));
    await page.keyboard.press("Escape");
    check("Esc đóng bảng, focus về chuông", !(await drawer.evaluate((d) => d.open)) && (await page.evaluate(() => document.activeElement?.classList.contains("notification-bell"))));
    await ctx.close();
  }

  // 6) Chế độ tối từ menu; Tab qua khung; liên kết bỏ qua menu; footer.
  {
    const { ctx, page } = await open(demoAfter, AFTER, "/dashboard", 1440);
    const toggle = page.locator(".site-header .ui-icon-button[aria-pressed]");
    await toggle.click();
    await page.waitForTimeout(60);
    const state = await page.evaluate(() => ({
      html: document.documentElement.dataset.theme,
      header: getComputedStyle(document.querySelector(".site-header")).backgroundColor,
      main: getComputedStyle(document.querySelector("#noi-dung-chinh")).backgroundColor,
    }));
    check("Nút chế độ tối trên menu: html tối, menu nền tối, nội dung trang cũ vẫn sáng", state.html === "dark" && state.header === "rgb(17, 24, 20)" && state.main === "rgb(251, 250, 246)", JSON.stringify(state));
    await toggle.click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.reload();
    await settle(page);
    await page.keyboard.press("Tab");
    check("Tab đầu tiên vào liên kết bỏ qua menu (hiện ra khi focus)", (await page.evaluate(() => document.activeElement?.className)) === "ui-skip-link"
      && (await page.locator(".ui-skip-link").boundingBox()).y >= 0);
    await page.keyboard.press("Enter");
    check("Bỏ qua menu → focus vào nội dung chính", (await page.evaluate(() => document.activeElement?.id)) === "noi-dung-chinh");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.reload();
    await settle(page);
    const stops = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(60);
      stops.push(await page.evaluate(() => {
        const el = document.activeElement;
        const cs = getComputedStyle(el);
        return { name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), inHeader: Boolean(el.closest(".site-header")) || el.classList.contains("ui-skip-link"),
          visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== "none" };
      }));
    }
    const headerStops = stops.filter((s) => s.inHeader);
    check(`Tab qua menu: ${headerStops.length} điểm dừng đều thấy focus`, headerStops.length >= 10 && headerStops.every((s) => s.visible), "không thấy: " + headerStops.filter((s) => !s.visible).map((s) => s.name).join(" | "));
    await page.locator(".site-footer").scrollIntoViewIfNeeded();
    await page.locator(".site-footer").screenshot({ path: `${DOCS}/footer_1440_sang.png` });
    const hrefs = await page.locator(".site-footer a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    const broken = [];
    for (const href of hrefs) {
      const p2 = await ctx.newPage();
      await p2.goto(AFTER + href);
      await p2.waitForTimeout(300);
      if (new URL(p2.url()).pathname !== href) broken.push(`${href} → ${new URL(p2.url()).pathname}`);
      await p2.close();
    }
    check(`Footer: ${hrefs.length} liên kết đều tới trang có thật`, broken.length === 0, broken.join(", "));
    await ctx.close();
  }

  // 7) Trang tĩnh, Landing (footer chung, không còn hình lá).
  for (const path of ["/privacy", "/terms"]) {
    for (const theme of ["light", "dark"]) {
      for (const w of [390, 1440]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: w < 500 ? 2 : 1, reducedMotion: "reduce" });
        await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
        const page = await ctx.newPage();
        page.on("pageerror", (e) => errors.push(`${path}: ${e}`));
        await page.goto(AFTER + path);
        await settle(page);
        if (path === "/privacy") await page.screenshot({ path: `${DOCS}/chinh-sach_${w}_${theme === "light" ? "sang" : "toi"}.png`, fullPage: true });
        await page.setViewportSize({ width: 320, height: 800 });
        check(`${path} ${theme} (${w}): không cuộn ngang ở 320px`, (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
        await ctx.close();
      }
    }
  }
  {
    const { ctx, page } = await open(undefined, AFTER, "/", 1440, "dark");
    const footer = page.locator(".site-footer");
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    check("Landing: footer chung, không còn FooterBotanical, cố định sáng", (await page.locator(".landing-footer-botanical, .landing-footer").count()) === 0
      && (await footer.count()) === 1 && (await page.locator(".landing-page").getAttribute("data-theme")) === "light");
    await footer.screenshot({ path: `${DOCS}/landing-footer_1440.png` });
    await ctx.close();
  }

  // Đã biết, có từ trước UI-2 (để GĐ4): đăng xuất xóa cache truy vấn khi trang còn hiển thị → vài request 401 ở /login.
  const known = (e) => e.includes("(trang http://localhost:5173/login)") || e.includes("status of 401");
  console.log("Đã biết (401 sau khi đăng xuất):", errors.filter(known).length);
  check("Console không có lỗi khác", errors.filter((e) => !known(e)).length === 0, errors.filter((e) => !known(e)).slice(0, 4).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
