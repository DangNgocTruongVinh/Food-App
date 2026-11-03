// GĐ3b-R2: ẩn món vi phạm ở "Tất cả công thức", cảnh báo + đổi món ở thực đơn cũ, dòng nhắc dưới chat AI,
// gợi ý dinh dưỡng tính ở backend. node r2-check.cjs <thư mục ảnh>.
// Có ghi dữ liệu demo: tạo 1 thực đơn, tạm thêm dị ứng "Hải sản" (khôi phục hồ sơ ở cuối), đổi 1 bữa. Chạy demo:reset sau đó.
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const [OUT] = process.argv.slice(2);
const APP = "http://localhost:5173";
const API = "http://localhost:4000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };

(async () => {
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ACC.demo()) })).json();
  const call = async (method, p, body) => {
    const res = await fetch(API + p, { method, headers: { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
  const original = (await call("GET", "/profile")).body.profile;
  const tomorrow = new Date(Date.now() + 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10);
  const plan = (await call("POST", "/meal-plans/generate", { startDate: tomorrow })).body;
  const seafood = /^(cá|tôm|nước mắm)/i;
  const hasSeafood = (item) => item.recipe.ingredients.some((ingredient) => seafood.test(ingredient.name));
  check("Thực đơn tạo với hồ sơ cũ có bữa hải sản (để thử cảnh báo)", plan.days.some((day) => day.items.some(hasSeafood)));
  const update = await call("PUT", "/profile", { allergies: [...original.allergies, "Hải sản"] });
  check("Thêm dị ứng Hải sản vào hồ sơ", update.status === 200);

  const apiPlan = (await call("GET", `/meal-plans/${plan.id}`)).body;
  const unsafe = apiPlan.days.flatMap((day) => day.items).filter((item) => !item.recipe.fit.safe);
  check("API: mọi bữa có hải sản đều có fit.safe = false", unsafe.length === apiPlan.days.flatMap((day) => day.items).filter(hasSeafood).length, `${unsafe.length} bữa`);
  check("API: gợi ý tuần không còn cá (backend tính theo hồ sơ mới)", apiPlan.suggestions.every((s) => !/cá/.test(s.text)), apiPlan.suggestions.map((s) => s.key).join(", "));
  const recipes = (await call("GET", "/recipes")).body;
  const violating = recipes.filter((recipe) => recipe.fit.allergens.length || recipe.fit.dietConflict).length;

  const browser = await chromium.launch();
  const errors = [];
  const open = async (path, w) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, reducedMotion: "reduce" });
    await ctx.addInitScript(([token, user]) => {
      localStorage.setItem("nouri_token", token); localStorage.setItem("nouri_user", JSON.stringify(user)); localStorage.setItem("nouri.theme", "light");
    }, [login.token, login.user]);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(APP + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    return { ctx, page };
  };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const firstUnsafeDay = apiPlan.days.findIndex((day) => day.items.some((item) => !item.recipe.fit.safe));

  for (const w of [1440, 390]) {
    // Tất cả công thức
    {
      const { ctx, page } = await open("/recipes", w);
      const section = page.locator("section[aria-labelledby=recipes-all-title]");
      const note = await section.locator(".recipes-results__profile").innerText();
      check(`Công thức ${w}: mặc định ẩn ${violating} món vi phạm, có công tắc "Hiện tất cả"`, note.includes(`Đã ẩn ${violating} món`) && /Hiện tất cả/.test(note), note.replace(/\n/g, " "));
      check(`Công thức ${w}: mặc định không thẻ nào có nhãn dị ứng`, (await section.locator(".recipe-tile__warnings").count()) === 0);
      check(`Công thức ${w}: số món = 33 − ${violating}`, (await section.locator(".recipes-results__count").innerText()) === `${33 - violating} món`);
      await section.screenshot({ path: `${OUT}/cong-thuc-mac-dinh_${w}_sang.png` });
      await section.getByRole("button", { name: "Hiện tất cả" }).click();
      await page.waitForTimeout(200);
      check(`Công thức ${w}: bật "Hiện tất cả" → nút ở trạng thái bật, đủ 33 món`, (await section.getByRole("button", { name: "Hiện tất cả" }).getAttribute("aria-pressed")) === "true"
        && (await section.locator(".recipes-results__count").innerText()) === "33 món");
      const labels = await section.locator(".recipe-tile__warnings").allInnerTexts();
      check(`Công thức ${w}: thẻ vi phạm có nhãn nêu thành phần`, labels.length > 0 && labels.every((text) => /Có thành phần bạn dị ứng: .+/.test(text) || /Có món bạn không thích/.test(text)), labels.slice(0, 2).join(" | "));
      check(`Công thức ${w}: không cuộn ngang`, (await overflow(page)) <= 0);
      const firstWarned = section.locator("li", { has: page.locator(".recipe-tile__warnings") }).first();
      await firstWarned.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/cong-thuc-hien-tat-ca_${w}_sang.png` });
      await ctx.close();
    }
    // Thực đơn cũ
    {
      const { ctx, page } = await open(`/meal-plans/${plan.id}`, w);
      await page.getByRole("tab").nth(firstUnsafeDay).click();
      await page.waitForTimeout(200);
      const warnings = await page.locator(".td-meal__warnings").allInnerTexts();
      const swaps = page.getByRole("button", { name: /^Đổi món: / });
      check(`Thực đơn ${w}: bữa vi phạm có cảnh báo và nút Đổi món`, warnings.length > 0 && warnings.every((t) => /dị ứng: .+/.test(t)) && (await swaps.count()) === warnings.length, warnings[0]);
      const suggestions = await page.locator(".td-suggestions").innerText();
      check(`Thực đơn ${w}: thẻ gợi ý dùng dữ liệu backend (không gợi ý cá)`, suggestions.length > 0 && !/cá/.test(suggestions), suggestions.replace(/\n/g, " | "));
      check(`Thực đơn ${w}: không cuộn ngang`, (await overflow(page)) <= 0);
      await page.locator(".td-meal__warnings").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/thuc-don-canh-bao_${w}_sang.png` });
      if (w === 1440) {
        const before = warnings.length;
        const name = (await swaps.first().getAttribute("aria-label")).replace("Đổi món: ", "");
        await swaps.first().click();
        await page.locator(".ui-toast").filter({ hasText: "Đã đổi" }).waitFor({ timeout: 8000 });
        const toast = await page.locator(".ui-toast").innerText();
        await page.waitForTimeout(300);
        check("Thực đơn 1440: bấm Đổi món → thông báo món cũ/món mới, bớt 1 cảnh báo", toast.includes(name) && (await page.locator(".td-meal__warnings").count()) === before - 1, toast);
        await page.screenshot({ path: `${OUT}/thuc-don-sau-doi-mon_${w}_sang.png` });
      }
      await ctx.close();
    }
    // Trợ lý AI
    {
      const { ctx, page } = await open("/assistant", w);
      const hint = page.getByText("Gợi ý của AI chỉ để tham khảo, hãy kiểm tra thành phần nếu bạn bị dị ứng.");
      check(`Trợ lý AI ${w}: dòng nhắc dị ứng dưới ô chat`, await hint.isVisible());
      check(`Trợ lý AI ${w}: ô nhập mô tả bằng dòng nhắc`, /as-composer-allergy/.test(await page.locator("#assistant-question").first().getAttribute("aria-describedby")));
      check(`Trợ lý AI ${w}: không cuộn ngang`, (await overflow(page)) <= 0);
      await page.screenshot({ path: `${OUT}/tro-ly-ai_${w}_sang.png` });
      await ctx.close();
    }
  }

  const after = (await call("GET", `/meal-plans/${plan.id}`)).body;
  const swapped = after.days.flatMap((day) => day.items).filter((item) => !item.recipe.fit.safe).length;
  check("API: sau khi đổi, số bữa vi phạm giảm 1", swapped === unsafe.length - 1);
  await call("PUT", "/profile", { allergies: original.allergies });
  check("Không lỗi JS", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} đạt`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => { console.error(error); process.exit(1); });
