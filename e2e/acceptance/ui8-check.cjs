// Nghiệm thu UI-8 (Hồ sơ + Đăng nhập/Đăng ký). node ui8-check.cjs <thư mục ảnh docs> <email tài khoản thử>
// Tài khoản thử đăng ký qua giao diện; khóa bằng SQL (bước ngoài script); hồ sơ demo trả về như cũ qua API.
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const [OUT, TEST_EMAIL] = process.argv.slice(2);
const AFTER = "http://localhost:5173";
const BEFORE = "http://localhost:8080";
const API = "http://localhost:4000/api";
const TEST_PASSWORD = ACC.testPassword;
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const sql = (query) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { cwd: ACC.ROOT, input: query }).toString().trim();

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

async function loginState(browser, base, email = ACC.demo().email, password = ACC.demo().password) {
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

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const login = async (email, password) => (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }));
  const token = (await (await login(ACC.demo().email, ACC.demo().password)).json()).token;
  const call = async (method, path, body) => (await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json();
  const original = await call("GET", "/profile");
  const p0 = original.profile;
  const restore = () => call("PUT", "/profile", {
    name: original.name, age: p0.age, gender: p0.gender, heightCm: p0.heightCm, weightKg: p0.weightKg, targetWeightKg: p0.targetWeightKg,
    activityLevel: p0.activityLevel, goal: p0.goal, dietType: p0.dietType, allergies: p0.allergies, dislikedFoods: p0.dislikedFoods,
    preferredCuisines: p0.preferredCuisines, mealsPerDay: p0.mealsPerDay,
  });

  const after = await loginState(browser, AFTER);
  const before = await loginState(browser, BEFORE);
  const open = async (state, base, path, w, theme = "light") => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: w < 500 ? 2 : 1, storageState: state, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    if (base === AFTER) {
      page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
    }
    await page.goto(base + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    return { ctx, page };
  };
  const themeName = (t) => (t === "light" ? "sang" : "toi");
  const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  // ---------- 1) Ảnh trước/sau ----------
  for (const [path, name, state] of [["/profile", "ho-so", "auth"], ["/login", "dang-nhap", null]]) {
    for (const w of [390, 1440]) {
      let { ctx, page } = await open(state ? before : undefined, BEFORE, path, w);
      await page.screenshot({ path: `${OUT}/${name}_${w}_truoc.png`, fullPage: true });
      await ctx.close();
      for (const theme of ["light", "dark"]) {
        ({ ctx, page } = await open(state ? after : undefined, AFTER, path, w, theme));
        await page.screenshot({ path: `${OUT}/${name}_${w}_sau_${themeName(theme)}.png`, fullPage: true });
        check(`${name} ${w}px ${theme}: không cuộn ngang, một <main>`, (await noOverflow(page)) <= 0 && (await page.locator("main").count()) === 1);
        if (path === "/profile") {
          const order = await page.evaluate(() => { const t = document.querySelector(".hs-targets").getBoundingClientRect(); const f = document.querySelector(".hs-form").getBoundingClientRect(); return { targetsAbove: t.bottom <= f.top + 1, targetsRight: t.left >= f.right - 1 }; });
          check(`Hồ sơ ${w}px: chỉ tiêu ${w >= 1024 ? "ở cột phải" : "ở trên cùng"}`, w >= 1024 ? order.targetsRight : order.targetsAbove, JSON.stringify(order));
        } else {
          const aside = await page.locator(".dn-aside").isVisible();
          check(`Đăng nhập ${w}px: ${w >= 1024 ? "hai cột (form + khối giới thiệu)" : "chỉ form"}`, w >= 1024 ? aside : !aside);
        }
        await ctx.close();
      }
    }
  }

  // ---------- 2) Hồ sơ: lỗi trường, thẻ, lưu, chỉ tiêu cập nhật, cảnh báo rời trang ----------
  {
    const { ctx, page } = await open(after, AFTER, "/profile", 1440);
    const h = (await page.locator("h1").innerText()).replace(/\s+/g, " ");
    check("Hồ sơ: H1 một cụm nghiêng, 4 nhóm có tiêu đề", (await page.locator("h1 em").count()) === 1
      && JSON.stringify(await page.locator(".hs-section__title").allInnerTexts()) === JSON.stringify(["Thông tin cơ bản", "Mục tiêu", "Chế độ ăn và dị ứng", "Khẩu vị"]), h);
    const cal0 = await page.locator(".hs-targets__number").innerText();
    check("Chỉ tiêu từ dữ liệu thật", cal0.replace(/\./g, "") === String(p0.dailyCalorieTarget), cal0);
    check("Có câu giải thích cách tính (Mifflin–St Jeor)", (await page.locator(".hs-targets__how").innerText()).includes("Mifflin–St Jeor"));
    // Lỗi trường.
    await page.getByLabel("Họ và tên").fill("A");
    await page.getByLabel("Tuổi").fill("200");
    await page.getByLabel("Chiều cao").fill("90");
    await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
    await page.waitForTimeout(300);
    const invalid = await page.locator("#profile-form [aria-invalid='true']").evaluateAll((els) => els.map((el) => ({
      label: document.querySelector(`label[for="${el.id}"]`)?.textContent,
      error: (el.getAttribute("aria-describedby") || "").split(" ").map((id) => document.getElementById(id)?.textContent).join(" "),
    })));
    check("Lỗi hiện dưới từng trường, nói cách sửa, focus trường sai đầu tiên",
      invalid.length === 3 && invalid[0].error.includes("2 đến 80 ký tự") && invalid[1].error.includes("13 đến 120") && invalid[2].error.includes("100 đến 250")
      && await page.evaluate(() => document.activeElement?.getAttribute("aria-invalid") === "true"), JSON.stringify(invalid));
    await page.locator("#profile-form").screenshot({ path: `${OUT}/ho-so-loi-truong_1440_sang.png` });
    check("Không gửi khi còn lỗi", (await call("GET", "/profile")).name === original.name);
    await page.getByLabel("Họ và tên").fill(original.name);
    await page.getByLabel("Tuổi").fill(String(p0.age ?? ""));
    await page.getByLabel("Chiều cao").fill(String(p0.heightCm ?? ""));
    // Thẻ dị ứng bằng bàn phím.
    const allergyInput = page.getByLabel("Dị ứng", { exact: true });
    await allergyInput.fill("Tôm");
    await allergyInput.press("Enter");
    await allergyInput.fill("tôm");
    await allergyInput.press("Enter");
    const dupError = await page.locator(".hs-tags", { has: page.getByLabel("Dị ứng", { exact: true }) }).locator(".ui-field__error").innerText();
    check("Thẻ: Enter thêm, trùng thì báo", (await page.getByRole("button", { name: "Bỏ dị ứng Tôm" }).count()) === 1 && dupError.includes("đã có trong danh sách"));
    await allergyInput.fill("");
    await page.getByRole("button", { name: "Bỏ dị ứng Tôm" }).focus();
    await page.keyboard.press("Enter");
    check("Thẻ: nút bỏ dùng được bằng bàn phím", (await page.getByRole("button", { name: "Bỏ dị ứng Tôm" }).count()) === 0);
    await page.getByRole("button", { name: "+ Thái Lan" }).click();
    check("Gợi ý ẩm thực bấm để thêm", (await page.getByRole("button", { name: "Bỏ ẩm thực Thái Lan" }).count()) === 1);
    // Đổi mục tiêu + cân nặng → lưu → chỉ tiêu cập nhật.
    await page.getByRole("radio", { name: "Giảm cân" }).check();
    await page.getByLabel("Cân nặng hiện tại").fill(String((p0.weightKg ?? 55) + 5));
    check("Có thay đổi chưa lưu: báo ở thẻ chỉ tiêu và cạnh nút lưu", await page.locator(".hs-targets__dirty").isVisible() && (await page.locator(".hs-actions__note").innerText()) === "Có thay đổi chưa lưu.");
    check("Rời trang khi chưa lưu: trình duyệt hỏi lại (beforeunload)", await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }));
    await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
    await page.locator(".ui-toast", { hasText: "Đã lưu hồ sơ" }).waitFor();
    await page.waitForTimeout(500);
    const savedProfile = (await call("GET", "/profile")).profile;
    const cal1 = (await page.locator(".hs-targets__number").innerText()).replace(/\./g, "");
    check("Lưu: báo \"Đã lưu hồ sơ\", API lưu đúng, chỉ tiêu cập nhật ngay", savedProfile.goal === "LOSE_WEIGHT" && savedProfile.preferredCuisines.includes("Thái Lan")
      && cal1 === String(savedProfile.dailyCalorieTarget) && savedProfile.dailyCalorieTarget !== p0.dailyCalorieTarget, `${p0.dailyCalorieTarget} → ${cal1}`);
    check("Sau khi lưu: không còn báo thay đổi chưa lưu", !(await page.locator(".hs-targets__dirty").isVisible()) && (await page.locator(".hs-actions__note").innerText()) === "Hồ sơ đã lưu.");
    await page.screenshot({ path: `${OUT}/ho-so-da-luu_1440_sang.png` });
    await ctx.close();
    await restore();
    const back = (await call("GET", "/profile")).profile;
    check("Trả hồ sơ demo về ban đầu", back.dailyCalorieTarget === p0.dailyCalorieTarget && back.goal === p0.goal && JSON.stringify(back.preferredCuisines) === JSON.stringify(p0.preferredCuisines));
  }

  // ---------- 3) Đăng nhập: nhớ / không nhớ, sai mật khẩu, lỗi trường ----------
  for (const remember of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(AFTER + "/login");
    const box = page.getByRole("checkbox", { name: "Nhớ đăng nhập trên máy này" });
    if ((await box.isChecked()) !== remember) await box.click();
    await page.getByLabel("Email").fill(ACC.demo().email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(ACC.demo().password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL("**/dashboard");
    const where = await page.evaluate(() => ({ local: Boolean(localStorage.getItem("nouri_token")), session: Boolean(sessionStorage.getItem("nouri_token")), pref: localStorage.getItem("nouri_remember_login") }));
    check(`Đăng nhập ${remember ? "có" : "không"} nhớ: phiên ở ${remember ? "localStorage" : "sessionStorage"}, nhớ lựa chọn`,
      remember ? where.local && !where.session : !where.local && where.session, JSON.stringify(where));
    if (!remember) {
      const p2 = await ctx.newPage();
      await p2.goto(AFTER + "/login");
      // Phiên không nhớ nằm ở tab cũ; tab mới mở /login và ô nhớ giữ lựa chọn lần trước (không tick).
      check("Ô \"Nhớ đăng nhập\" giữ lựa chọn lần trước", !(await p2.getByRole("checkbox", { name: "Nhớ đăng nhập trên máy này" }).isChecked()));
      await p2.getByRole("checkbox", { name: "Nhớ đăng nhập trên máy này" }).check();
      await p2.evaluate(() => localStorage.setItem("nouri_remember_login", "true"));
    }
    await ctx.close();
  }
  for (const w of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(undefined, AFTER, "/login", w, theme);
      await page.getByLabel("Email").fill(ACC.demo().email);
      await page.getByLabel("Mật khẩu", { exact: true }).fill("SaiMatKhau1");
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.locator(".ui-error").waitFor();
      if (w === 1440 && theme === "light") check("Sai mật khẩu: \"Email hoặc mật khẩu chưa đúng…\"", (await page.locator(".ui-error").innerText()).includes("Email hoặc mật khẩu chưa đúng"));
      await page.screenshot({ path: `${OUT}/dang-nhap-sai-mat-khau_${w}_${themeName(theme)}.png`, fullPage: true });
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open(undefined, AFTER, "/login", 1440);
    await page.getByLabel("Email").fill("demo@nouri");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("123");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    const errs = await page.locator(".ui-field__error").allInnerTexts();
    check("Lỗi trường đăng nhập (email, mật khẩu) trước khi gửi", errs.length === 2 && errs[0].includes("ten@gmail.com") && errs[1].includes("8 ký tự"), errs.join(" | "));
    await page.screenshot({ path: `${OUT}/dang-nhap-loi-truong_1440_sang.png` });
    const toggle = page.getByRole("button", { name: "Hiện mật khẩu" });
    await toggle.click();
    check("Hiện/ẩn mật khẩu: aria-label đổi, ô thành text", (await page.getByLabel("Mật khẩu", { exact: true }).getAttribute("type")) === "text"
      && (await page.getByRole("button", { name: "Ẩn mật khẩu" }).getAttribute("aria-pressed")) === "true");
    await ctx.close();
  }

  // ---------- 4) Đăng ký (tài khoản thử), email trùng, tài khoản bị khóa ----------
  for (const w of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(undefined, AFTER, "/login", w, theme);
      await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
      await page.screenshot({ path: `${OUT}/dang-ky_${w}_${themeName(theme)}.png`, fullPage: true });
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open(undefined, AFTER, "/login", 1440);
    await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
    check("Chuyển sang Đăng ký: có ô Họ và tên, nút Tạo tài khoản", (await page.getByLabel("Họ và tên").count()) === 1 && (await page.getByRole("button", { name: "Tạo tài khoản" }).count()) === 1);
    await page.getByLabel("Họ và tên").fill("Thử UI8");
    await page.getByLabel("Email").fill(ACC.demo().email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await page.locator(".ui-error").waitFor();
    check("Đăng ký email trùng: báo rõ", (await page.locator(".ui-error").innerText()).includes("Email này đã có tài khoản"));
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await page.waitForURL("**/dashboard", { timeout: 20000 });
    check("Đăng ký tài khoản thử: vào Tổng quan", true, TEST_EMAIL);
    await page.goto(AFTER + "/profile");
    await page.waitForLoadState("networkidle");
    check("Tài khoản mới: thẻ chỉ tiêu mời lưu hồ sơ", (await page.locator(".hs-targets").innerText()).includes("Lưu hồ sơ để Nouri tính"));
    await page.screenshot({ path: `${OUT}/ho-so-tai-khoan-moi_1440_sang.png`, fullPage: true });
    await ctx.close();
  }
  sql(`update "User" set "lockedAt" = now() where email = '${TEST_EMAIL}'`);
  for (const w of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(undefined, AFTER, "/login", w, theme);
      await page.getByLabel("Email").fill(TEST_EMAIL);
      await page.getByLabel("Mật khẩu", { exact: true }).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.locator(".ui-error").waitFor();
      if (w === 1440 && theme === "light") check("Tài khoản bị khóa (ACCOUNT_LOCKED): báo rõ, không vào được", (await page.locator(".ui-error").innerText()).includes("đã bị khóa") && page.url().endsWith("/login"));
      await page.screenshot({ path: `${OUT}/dang-nhap-bi-khoa_${w}_${themeName(theme)}.png`, fullPage: true });
      await ctx.close();
    }
  }

  // ---------- 5) Tương phản, Tab, phông, 320px ----------
  for (const [path, name, state] of [["/profile", "Hồ sơ", after], ["/login", "Đăng nhập", undefined]]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(state, AFTER, path, 1440, theme);
      if (path === "/profile") await page.getByLabel("Cân nặng hiện tại").fill("70");
      const sels = path === "/profile"
        ? [".hs-section__title", ".hs-section__head .ui-small", ".ui-field__label", ".ui-field__hint", ".hs-unit__label", ".ui-choice__option input:checked + span", ".ui-choice__option input:not(:checked) + span",
          ".hs-tags__item span", ".hs-tags__suggestion", ".hs-targets__number", ".hs-targets__macros dt", ".hs-targets__how", ".hs-targets__dirty", ".hs-actions__note"]
        : [".dn-form__head .ui-text", ".ui-field__label", ".dn-remember span", ".dn-switch", ".dn-switch__button", ".dn-legal", ".dn-aside__text"];
      const pairs = await page.evaluate(`(${(fn, list) => list.flatMap((sel) => [...document.querySelectorAll(sel)].slice(0, 1).map((el) => [sel, Math.round(fn(el) * 100) / 100]))})(${contrastOf.toString()}, ${JSON.stringify(sels)})`);
      const weak = pairs.filter(([, r]) => r < 4.5);
      check(`${name} tương phản ${theme}: ${pairs.length} cặp ≥ 4.5:1`, pairs.length >= sels.length - 1 && weak.length === 0, (weak.length ? weak : pairs).map(([s, r]) => `${s}=${r}`).join(" "));
      if (theme === "light") {
        await page.reload(); await page.waitForLoadState("networkidle");
        const hidden = []; let stops = 0;
        for (let i = 0; i < 70; i++) {
          await page.keyboard.press("Tab"); await page.waitForTimeout(60);
          const info = await page.evaluate(() => {
            const el = document.activeElement; if (!el || el === document.body) return null;
            const target = el.matches("input[type=radio]") ? el.nextElementSibling : el;
            const cs = getComputedStyle(target); const own = getComputedStyle(el);
            return { name: (el.getAttribute("aria-label") || el.value || el.textContent || el.id || "").trim().slice(0, 30), main: Boolean(el.closest("main")),
              visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (own.outlineStyle !== "none" && parseFloat(own.outlineWidth) >= 2) || (own.boxShadow !== "none" && own.boxShadow !== "") };
          });
          if (!info) break;
          if (info.main) { stops++; if (!info.visible) hidden.push(info.name); }
        }
        check(`${name}: Tab ${stops} điểm dừng đều thấy focus`, stops >= (path === "/profile" ? 20 : 6) && hidden.length === 0, hidden.slice(0, 5).join(" | "));
        const client = await ctx.newCDPSession(page);
        await client.send("DOM.enable"); await client.send("CSS.enable");
        const { root } = await client.send("DOM.getDocument", { depth: -1 });
        const issues = [];
        for (const selector of ["h1", "h1 em", ".hs-section__title", ".hs-targets__title", ".dn-aside__text"]) {
          const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
          for (const nodeId of nodeIds) {
            const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
            if (!fonts.every((f) => /Fraunces/.test(f.familyName) && f.isCustomFont)) issues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
          }
        }
        check(`${name}: tiêu đề có dấu chồng vẽ bằng Fraunces`, issues.length === 0, issues.join("; "));
        await page.setViewportSize({ width: 320, height: 800 });
        await page.waitForTimeout(300);
        check(`${name}: 320px không cuộn ngang`, (await noOverflow(page)) <= 0);
      }
      await ctx.close();
    }
  }

  const restored = (await call("GET", "/profile")).profile;
  check("Hồ sơ demo đúng như đầu lượt", JSON.stringify({ ...restored, updatedAt: 0 }) === JSON.stringify({ ...p0, updatedAt: 0 }));
  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
