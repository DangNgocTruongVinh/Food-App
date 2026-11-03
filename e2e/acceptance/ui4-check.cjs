// Nghiệm thu UI-4 (Công thức + Chi tiết). node ui4-check.cjs <thư mục ảnh docs> <id món>
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const [OUT, RID] = process.argv.slice(2);
const AFTER = "http://localhost:5173";
const BEFORE = "http://localhost:8080";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };

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

(async () => {
  const browser = await chromium.launch();
  const errors = [];
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
    await page.waitForTimeout(400);
    return { ctx, page };
  };
  const token = (await (await fetch("http://localhost:4000/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json()).token;
  const recipesApi = await (await fetch("http://localhost:4000/api/recipes", { headers: { Authorization: `Bearer ${token}` } })).json();

  // 1) Ảnh trước (8080, bản main) / sau (5173): 390 & 1440, sáng & tối.
  for (const [path, name] of [["/recipes", "cong-thuc"], [`/recipes/${RID}`, "chi-tiet"]]) {
    for (const w of [390, 1440]) {
      let { ctx, page } = await open(before, BEFORE, path, w);
      await page.screenshot({ path: `${OUT}/${name}_${w}_truoc.png`, fullPage: true });
      await ctx.close();
      for (const theme of ["light", "dark"]) {
        ({ ctx, page } = await open(after, AFTER, path, w, theme));
        await page.screenshot({ path: `${OUT}/${name}_${w}_sau_${theme === "light" ? "sang" : "toi"}.png`, fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        check(`${name} ${w}px ${theme}: không cuộn ngang, nội dung đổi theo chế độ`, overflow <= 0 && (await page.locator("#noi-dung-chinh").getAttribute("data-theme")) === null, `${overflow}px`);
        await ctx.close();
      }
    }
  }

  // 2) Trang Công thức: chức năng.
  {
    const { ctx, page } = await open(after, AFTER, "/recipes", 1440);
    const h1 = (await page.locator("h1").innerText()).replace(/\s+/g, " ");
    check("H1 hero có một cụm nghiêng màu accent", h1 === "Bếp nhà, nấu mỗi ngày." && (await page.locator("h1 em").count()) === 1);
    const chips = await page.locator(".recipes-filters__chips .ui-chip").evaluateAll((els) => els.map((el) => el.textContent));
    const expected = {
      "Tất cả": recipesApi.length,
      "Việt Nam": recipesApi.filter((r) => r.cuisine.toLowerCase().includes("việt")).length,
      "Quốc tế": recipesApi.filter((r) => !r.cuisine.toLowerCase().includes("việt")).length,
      "Ăn sáng": recipesApi.filter((r) => r.mealTypes?.includes("BREAKFAST")).length,
      "Cân bằng": recipesApi.filter((r) => r.dietTags.includes("BALANCED")).length,
      "Ít tinh bột": recipesApi.filter((r) => r.dietTags.includes("LOW_CARB")).length,
      "Món chay": recipesApi.filter((r) => r.dietTags.some((t) => t === "VEGETARIAN" || t === "VEGAN")).length,
    };
    const shown = Object.fromEntries(chips.map((text) => [text.replace(/\d+$/, ""), Number(text.match(/\d+$/)?.[0])]));
    check("Chip tiếng Việt, số món khớp API", JSON.stringify(shown) === JSON.stringify(expected), JSON.stringify(shown));
    await page.locator(".recipes-filters__chips .ui-chip", { hasText: "Món chay" }).click();
    check("Chọn chip → aria-pressed, số kết quả đổi theo", (await page.locator(".recipes-filters__chips .ui-chip", { hasText: "Món chay" }).getAttribute("aria-pressed")) === "true"
      && (await page.locator(".recipes-results__count").innerText()) === `${expected["Món chay"]} món`);
    await page.locator(".recipes-filters__chips .ui-chip", { hasText: "Tất cả" }).click();
    await page.locator("#recipes-search").fill("ức gà");
    const searchCount = Number((await page.locator(".recipes-results__count").innerText()).match(/\d+/)[0]);
    const firstTitles = await page.locator(".recipe-tile__title").allInnerTexts();
    check("Tìm kiếm lọc theo tên/nguyên liệu", searchCount > 0 && searchCount < recipesApi.length, `${searchCount} món: ${firstTitles.slice(0, 3).join(", ")}`);
    await page.locator("#recipes-search").fill("zzzz không có");
    check("Không có kết quả → EmptyState + Xóa bộ lọc", (await page.locator(".ui-empty").innerText()).includes("Không có công thức nào"));
    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    check("Xóa bộ lọc → về đủ món", (await page.locator(".recipes-results__count").innerText()) === `${recipesApi.length} món`);
    await page.locator("#recipes-sort").selectOption("calories");
    const kcal = await page.locator(".recipe-tile .recipe-specs li:nth-child(2)").allInnerTexts();
    const nums = kcal.map((t) => Number(t.replace(/\D/g, "")));
    check("Sắp xếp Ít calo", nums.every((n, i) => i === 0 || nums[i - 1] <= n), nums.join(","));
    await page.getByRole("button", { name: "Trang 2" }).click();
    check("Phân trang: trang 2 aria-current", (await page.getByRole("button", { name: "Trang 2" }).getAttribute("aria-current")) === "page");
    await page.getByRole("button", { name: "Hiển thị dạng danh sách" }).click();
    check("Dạng danh sách (aria-pressed) có mô tả món", (await page.getByRole("button", { name: "Hiển thị dạng danh sách" }).getAttribute("aria-pressed")) === "true" && (await page.locator(".recipe-tile__desc").count()) > 0);
    await page.screenshot({ path: `${OUT}/cong-thuc_1440_danh-sach.png` });
    await page.getByRole("button", { name: "Bộ lọc" }).click();
    check("Bộ lọc thu gọn hàng chip (aria-expanded)", (await page.getByRole("button", { name: "Bộ lọc" }).getAttribute("aria-expanded")) === "false" && !(await page.locator(".recipes-filters__chips").isVisible()));
    check("Đã ẩn nút yêu thích (chỉ state cục bộ)", (await page.locator("[aria-label*='yêu thích']").count()) === 0);
    const feature = await page.locator(".recipes-feature").innerText();
    check("Dành cho bạn: thẻ lớn có Có trong kho / Còn thiếu / % mục tiêu, kèm thẻ nhỏ", /Có trong kho/.test(feature) && /Còn thiếu/.test(feature) && /mục tiêu calo ngày/.test(feature)
      && (await page.locator(".recipes-side").count()) >= 1);
    const text = await page.locator("#noi-dung-chinh").innerText();
    check("Không có '·', '→', Healthy, Low Carb, protein, emoji", !/[·→]|Healthy|Low Carb|protein|\p{Extended_Pictographic}/u.test(text));
    const tiles = await page.locator(".recipe-tile .ui-recipe-image--empty").count();
    const ph = await page.locator(".recipes-feature .ui-recipe-image--empty").getAttribute("aria-label");
    check("Món chưa có ảnh thật: ô surface-2 kèm tên (không ảnh nhóm)", tiles > 0 && /chưa có ảnh$/.test(ph ?? "") && (await page.locator("img[src*='/assets/recipe-']").count()) === 0, `${tiles} ô; ${ph}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(after, AFTER, `/recipes?q=${encodeURIComponent("cá")}`, 1440);
    check("Tham số ?q= điền sẵn ô tìm (từ Tổng quan)", (await page.locator("#recipes-search").inputValue()) === "cá");
    await ctx.close();
  }

  // 3) Chi tiết: chức năng.
  {
    const { ctx, page } = await open(after, AFTER, `/recipes/${RID}`, 1440);
    const facts = await page.locator(".recipe-facts dt").allInnerTexts();
    check("Thông số dạng nhãn có tên (Thời gian, Khẩu phần, Calo)", JSON.stringify(facts) === JSON.stringify(["Thời gian", "Khẩu phần", "Calo"]));
    const amount = () => page.locator(".recipe-ingredients__amount").first().innerText();
    const a1 = await amount();
    await page.getByRole("button", { name: "Tăng 1 khẩu phần" }).click();
    const a2 = await amount();
    check("Chỉnh khẩu phần nhân định lượng + gợi ý Về như công thức", a1 !== a2 && (await page.getByRole("button", { name: "Về như công thức" }).count()) === 1, `${a1} → ${a2}`);
    await page.getByRole("button", { name: "Về như công thức" }).click();
    check("Về như công thức", (await amount()) === a1);
    check("Các bước đánh số", (await page.locator(".recipe-steps__number").count()) > 1);
    const share = await page.getByRole("link", { name: "Chia sẻ lên cộng đồng" }).getAttribute("href");
    check("Nút Chia sẻ lên cộng đồng trỏ /community?shareRecipe=", share === `/community?shareRecipe=${RID}`, share);
    check("Cột phải dính khi cuộn (≥1024px)", (await page.locator(".recipe-detail__side").evaluate((el) => getComputedStyle(el).position)) === "sticky");
    check("Chưa có nút Thêm vào thực đơn (GĐ5)", (await page.getByText("Thêm vào thực đơn").count()) === 0);
    await ctx.close();
  }
  // Cảnh báo theo hồ sơ (giả lập phản hồi /for-you, không đổi dữ liệu): 390px thấy được không cần cuộn.
  {
    const { ctx, page } = await open(after, AFTER, `/recipes/${RID}`, 390, "light", async (p) => {
      await p.route(`**/api/recipes/${RID}/for-you`, async (route) => {
        const res = await route.fetch(); const body = await res.json();
        body.warnings = { allergens: ["Cá basa"], dislikedFoods: ["Hành lá"], dietConflict: "VEGETARIAN" };
        await route.fulfill({ response: res, json: body });
      });
    });
    const box = await page.locator(".recipe-alerts").boundingBox();
    check("Cảnh báo dị ứng/không thích/chế độ ăn nền warn-bg, thấy ngay trên điện thoại", Boolean(box) && box.y + box.height <= 844
      && (await page.locator(".recipe-alerts li").count()) === 3, box ? `đáy ${Math.round(box.y + box.height)}px / 844px` : "");
    await page.screenshot({ path: `${OUT}/chi-tiet_390_canh-bao.png` });
    await ctx.close();
  }
  // Món đã ngừng sử dụng (giả lập hidden: true).
  {
    const { ctx, page } = await open(after, AFTER, `/recipes/${RID}`, 1440, "light", async (p) => {
      await p.route(`**/api/recipes/${RID}`, async (route) => {
        const res = await route.fetch(); const body = await res.json();
        await route.fulfill({ response: res, json: { ...body, hidden: true } });
      });
    });
    check("Món đã ngừng sử dụng: thông báo rõ, ẩn chia sẻ và Dành cho bạn", (await page.locator(".recipe-hidden-note").innerText()).includes("Món này đã ngừng sử dụng")
      && (await page.getByText("Chia sẻ lên cộng đồng").count()) === 0 && (await page.locator(".recipe-fit").count()) === 0);
    await page.screenshot({ path: `${OUT}/chi-tiet_1440_ngung-su-dung.png` });
    await ctx.close();
  }
  // Không tìm thấy, lỗi + Thử lại, đang tải.
  {
    let { ctx, page } = await open(after, AFTER, "/recipes/cm0000000000000000000000x", 1440);
    check("Không tìm thấy: EmptyState + Về danh sách công thức", (await page.locator(".ui-empty").innerText()).includes("Không tìm thấy công thức này"));
    await ctx.close();
    let fail = true;
    ({ ctx, page } = await open(after, AFTER, `/recipes/${RID}`, 1440, "light", async (p) => {
      await p.route(`**/api/recipes/${RID}`, (route) => (fail ? route.fulfill({ status: 500, json: {} }) : route.continue()));
    }));
    await page.locator(".ui-error").waitFor({ timeout: 20000 });
    check("Lỗi: ErrorState có Thử lại", (await page.locator(".ui-error").innerText()).includes("Chưa tải được công thức"));
    fail = false;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await page.locator(".recipe-hero h1").waitFor({ timeout: 20000 });
    check("Thử lại → tải được món", true);
    await ctx.close();
    for (const [path, name, selector] of [["/recipes", "cong-thuc", ".recipes-view[role=status]"], [`/recipes/${RID}`, "chi-tiet", ".recipe-detail[role=status]"]]) {
      let release; const gate = new Promise((r) => { release = r; });
      ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: after });
      page = await ctx.newPage();
      await page.route(path === "/recipes" ? "**/api/recipes" : `**/api/recipes/${RID}`, async (route) => { await gate; await route.continue(); });
      await page.goto(AFTER + path);
      await page.locator(selector).waitFor();
      await page.screenshot({ path: `${OUT}/${name}_1440_dang-tai.png` });
      check(`${name}: đang tải → skeleton`, (await page.locator(`${selector} .ui-skeleton`).count()) >= 3);
      release();
      await ctx.close();
    }
  }

  // 4) Tab, 320px, phông tiêu đề.
  for (const path of ["/recipes", `/recipes/${RID}`]) {
    const { ctx, page } = await open(after, AFTER, path, 1440);
    const hidden = []; let stops = 0;
    for (let i = 0; i < 40; i++) {
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
    check(`${path}: Tab ${stops} điểm dừng trong nội dung đều thấy focus`, stops >= (path === "/recipes" ? 8 : 3) && hidden.length === 0, hidden.join(" | "));
    const client = await ctx.newCDPSession(page);
    await client.send("DOM.enable"); await client.send("CSS.enable");
    const { root } = await client.send("DOM.getDocument", { depth: -1 });
    const issues = [];
    for (const selector of ["h1", "h1 em", "h2.ui-section-title"]) {
      const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: `#noi-dung-chinh ${selector}` });
      for (const nodeId of nodeIds) {
        const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
        if (!fonts.every((f) => /Fraunces/.test(f.familyName) && f.isCustomFont)) issues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
      }
    }
    check(`${path}: tiêu đề (dấu chồng) vẽ bằng Fraunces`, issues.length === 0, issues.join("; "));
    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(300);
    check(`${path}: 320px không cuộn ngang`, (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
    await ctx.close();
  }

  // 5) Ảnh món ở trang cũ: ô chọn công thức (Cộng đồng), carousel Landing.
  {
    const { ctx, page } = await open(after, AFTER, "/community", 1440);
    await page.locator(".community-recipe-tool").click();
    await page.locator(".community-recipe-picker li").first().waitFor();
    const size = await page.locator(".community-recipe-picker li .ui-recipe-image").first().boundingBox();
    check("Cộng đồng: ô chọn công thức hiện ô tên món 44×36 (thay ảnh nhóm)", size && Math.round(size.width) === 44 && Math.round(size.height) === 36, size ? `${Math.round(size.width)}×${Math.round(size.height)}` : "");
    await ctx.close();
  }
  {
    const { ctx, page } = await open(undefined, AFTER, "/", 1440);
    const media = await page.locator(".landing-recipe-media .ui-recipe-image").first().boundingBox();
    check("Landing: carousel dùng ô tên món lấp đầy khung", Boolean(media) && media.width > 150 && media.height > 150, media ? `${Math.round(media.width)}×${Math.round(media.height)}` : "");
    await ctx.close();
  }

  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
