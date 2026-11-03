// GĐ3b-R7: gợi ý trên giao diện. node r7-check.cjs <thư mục ảnh>. Chỉ đọc dữ liệu demo (không tạo/sửa gì).
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const [OUT] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };

(async () => {
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json();
  const get = async (p) => (await fetch(API + p, { headers: { Authorization: `Bearer ${login.token}` } })).json();
  const recipes = await get("/recipes");
  const bySlug = new Map(recipes.map((r) => [r.slug, r]));
  const base = bySlug.get("bun-xao-chay");
  const browser = await chromium.launch();
  const errors = [];
  const open = async (path, w, setup, idle = true) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, reducedMotion: "reduce" });
    await ctx.addInitScript(([token, user]) => {
      localStorage.setItem("nouri_token", token); localStorage.setItem("nouri_user", JSON.stringify(user)); localStorage.setItem("nouri.theme", "light");
    }, [login.token, login.user]);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    if (setup) await setup(page);
    await page.goto(APP + path);
    if (idle) {
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
    }
    return { ctx, page };
  };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const reasons = (scope) => scope.locator(".rc-card__reason").allInnerTexts();

  for (const w of [1440, 390]) {
    // Tổng quan
    {
      const { ctx, page } = await open("/dashboard", w);
      const hero = await page.locator(".dash-hero__dish").innerText();
      const list = await reasons(page.locator(".dash-recs"));
      check(`Tổng quan ${w}: món hôm nay có lý do, "Gợi ý cho bạn" 3 thẻ đều có lý do`, /Gợi ý cho bạn: .+\. .+/.test(hero) && list.length === 3, `${hero.split("\n")[0]} | ${list.join(" | ")}`);
      check(`Tổng quan ${w}: không cuộn ngang`, (await overflow(page)) <= 0);
      await page.screenshot({ path: `${OUT}/tong-quan_${w}_sang.png`, fullPage: true });
      await ctx.close();
    }
    // Công thức
    {
      const { ctx, page } = await open("/recipes", w);
      const section = page.locator("section[aria-labelledby=recipes-for-you-title]");
      const texts = await section.locator(".rc-card__reason").allInnerTexts();
      check(`Công thức ${w}: "Dành cho bạn" 3 món, mỗi món có lý do`, texts.length === 3, texts.join(" | "));
      check(`Công thức ${w}: không cuộn ngang`, (await overflow(page)) <= 0);
      await section.screenshot({ path: `${OUT}/cong-thuc-danh-cho-ban_${w}_sang.png` });
      await ctx.close();
    }
    // Chi tiết món
    {
      const { ctx, page } = await open(`/recipes/${base.id}`, w);
      const similar = page.locator("section[aria-labelledby=rc-similar-title]");
      const also = page.locator("section[aria-labelledby=rc-also-title]");
      await similar.locator(".rc-card").first().waitFor();
      const sim = await similar.locator(".rc-card__title").allInnerTexts();
      const alsoTitles = (await also.count()) ? await also.locator(".rc-card__title").allInnerTexts() : [];
      check(`Chi tiết ${w}: "Món tương tự" 4 món có lý do, không gồm chính món`, sim.length === 4 && !sim.includes(base.name)
        && (await reasons(similar)).length === 4, sim.join(", "));
      check(`Chi tiết ${w}: "Người khác cũng nấu" có món (đủ dữ liệu nhờ tài khoản mẫu)`, alsoTitles.length > 0, alsoTitles.join(", "));
      check(`Chi tiết ${w}: không cuộn ngang`, (await overflow(page)) <= 0);
      await page.screenshot({ path: `${OUT}/chi-tiet-mon_${w}_sang.png`, fullPage: true });
      await ctx.close();
    }
    // Kho + hộp thoại Gợi ý món
    {
      const { ctx, page } = await open("/pantry", w);
      const ideas = page.locator(".kho-cook");
      check(`Kho ${w}: "Nấu gì từ kho?" có món kèm lý do`, (await reasons(ideas)).length > 0, (await reasons(ideas)).join(" | "));
      await page.screenshot({ path: `${OUT}/kho_${w}_sang.png`, fullPage: true });
      const button = page.getByRole("button", { name: "Gợi ý món dùng Đậu hũ" }).first();
      check(`Kho ${w}: nút "Gợi ý món" trên dòng sắp hết hạn (Đậu hũ)`, await button.isVisible());
      await button.click();
      const dialog = page.locator("dialog[open]");
      await dialog.locator(".rc-card").first().waitFor();
      const names = await dialog.locator(".rc-card__title").allInnerTexts();
      const allUseTofu = names.every((name) => recipes.find((r) => r.name === name)?.ingredients.some((i) => i.name === "Đậu hũ"));
      check(`Kho ${w}: hộp thoại liệt kê món dùng Đậu hũ, có lý do`, names.length > 0 && allUseTofu && (await reasons(dialog)).length === names.length, names.join(", "));
      await page.screenshot({ path: `${OUT}/kho-goi-y-mon_${w}_sang.png` });
      if (w === 1440) {
        await dialog.locator(".rc-card__title a").first().click();
        await page.waitForURL(/\/recipes\//);
        check("Kho: bấm món trong hộp thoại → mở chi tiết món", /\/recipes\/c/.test(page.url()));
      }
      await ctx.close();
    }
    // Cộng đồng
    {
      const { ctx, page } = await open("/community", w);
      const tags = await page.locator(".cm-sample-tag").count();
      check(`Cộng đồng ${w}: bài của tài khoản mẫu có nhãn "Tài khoản mẫu"`, tags >= 8, `${tags} nhãn`);
      check(`Cộng đồng ${w}: không cuộn ngang`, (await overflow(page)) <= 0);
      await page.locator(".cm-post").first().screenshot({ path: `${OUT}/cong-dong-tai-khoan-mau_${w}_sang.png` });
      await ctx.close();
    }
  }
  // API cộng đồng: cờ isSample, không có email.
  const feed = await get("/community");
  const posts = Array.isArray(feed) ? feed : feed.items ?? feed.posts ?? [];
  check("API cộng đồng: tác giả có isSample, không có email", posts.length > 0 && posts.every((p) => "isSample" in p.author && !("email" in p.author)));

  // Trạng thái đang tải / lỗi (giả lập API, không đổi dữ liệu).
  {
    const { ctx, page } = await open(`/recipes/${base.id}`, 1440, (p) => p.route("**/api/recommendations**", async (r) => { await new Promise((x) => setTimeout(x, 2500)); await r.continue(); }), false);
    const loading = page.locator("section[aria-labelledby=rc-similar-title] .ui-loading");
    await loading.waitFor({ timeout: 5000 }).catch(() => {});
    check("Chi tiết: khung chờ khi đang tải gợi ý", (await loading.count()) > 0);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(`/recipes/${base.id}`, 1440, (p) => p.route("**/api/recommendations**", (r) => r.fulfill({ status: 500, body: "{}" })));
    const section = page.locator("section[aria-labelledby=rc-similar-title]");
    await section.getByText("Chưa tải được món tương tự.").waitFor({ timeout: 15000 });
    check("Chi tiết: lỗi gợi ý → báo lỗi + Thử lại; \"Người khác cũng nấu\" ẩn", await section.getByRole("button", { name: /Thử lại/ }).isVisible()
      && (await page.locator("section[aria-labelledby=rc-also-title]").count()) === 0);
    await section.screenshot({ path: `${OUT}/chi-tiet-loi_1440_sang.png` });
    await ctx.close();
  }
  {
    const { ctx, page } = await open("/recipes", 1440, (p) => p.route("**/api/recommendations**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ coldStart: true, items: [] }) })));
    check("Công thức: không có gợi ý → trạng thái trống", await page.locator("section[aria-labelledby=recipes-for-you-title]").getByText("Chưa có món nào hợp với hồ sơ của bạn.").isVisible());
    await ctx.close();
  }
  check("Không có lỗi JavaScript", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
