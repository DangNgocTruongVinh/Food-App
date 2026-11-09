// Nghiệm thu lượt UI-1 trên Vite dev (http://localhost:5173/dev/ui). node ui1-check.cjs <thư mục ảnh>
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const OUT = process.argv[2];
const URL_ = "http://localhost:5173/dev/ui";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // 1) Ảnh 390 / 1440 × sáng / tối (chế độ chung đặt qua localStorage trước khi tải).
  for (const theme of ["light", "dark"]) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w === 390 ? 2 : 1 });
      await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
      const page = await ctx.newPage();
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(URL_);
      await page.locator(".dev-ui-panel").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/dev-ui_${w}_${theme === "light" ? "sang" : "toi"}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(`${w}px ${theme}: không cuộn ngang`, overflow <= 0, `${overflow}px`);
      await ctx.close();
    }
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL_);
  await page.locator(".dev-ui-panel").first().waitFor();
  await page.evaluate(() => document.fonts.ready);

  // 2) Phông thực tế được vẽ cho chuỗi có dấu chồng (CDP): mọi glyph phải từ Fraunces / Be Vietnam Pro.
  const client = await ctx.newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  const { root } = await client.send("DOM.getDocument", { depth: -1 });
  const selectors = ['.dev-ui-panel[data-theme="light"] .dev-ui-font', '.dev-ui-panel[data-theme="light"] .ui-hero-title', '.dev-ui-panel[data-theme="light"] .ui-hero-title em', '.dev-ui-panel[data-theme="light"] .ui-title', '.dev-ui-panel[data-theme="light"] .ui-logo'];
  for (const selector of selectors) {
    const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
    if (!nodeIds.length) check(`Tìm thấy phần tử ${selector}`, false);
    for (const nodeId of nodeIds) {
      const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
      const { outerHTML } = await client.send("DOM.getOuterHTML", { nodeId });
      const style = (outerHTML.match(/style="([^"]*)"/) || [, ""])[1];
      const label = outerHTML.replace(/<[^>]+>/g, "").slice(0, 34);
      const expected = selector.includes("dev-ui-font--sans") || outerHTML.includes("dev-ui-font--sans") ? /Be Vietnam Pro/ : /Fraunces/;
      const ok = fonts.length > 0 && fonts.every((f) => expected.test(f.familyName) && f.isCustomFont);
      check(`Phông ${selector.replace('.dev-ui-panel[data-theme="light"] ', "")} "${label}" ${style}`, ok, fonts.map((f) => `${f.familyName}${f.isCustomFont ? "" : " (hệ thống)"}×${f.glyphCount}`).join(", "));
    }
  }
  const panel = page.locator('.dev-ui-panel[data-theme="light"] .dev-ui-fonts');
  await panel.screenshot({ path: `${OUT}/phong-chu-dau-chong_sang.png` });
  await page.locator('.dev-ui-panel[data-theme="dark"] .dev-ui-fonts').screenshot({ path: `${OUT}/phong-chu-dau-chong_toi.png` });

  // 3) Nút chuyển chế độ: aria-pressed, data-theme, nhớ sau khi tải lại.
  const toggle = page.locator(".dev-ui-header .ui-icon-button");
  check("Nút chế độ tối có aria-label và aria-pressed=false lúc đầu (mặc định sáng)",
    (await toggle.getAttribute("aria-label")) === "Chế độ tối" && (await toggle.getAttribute("aria-pressed")) === "false"
      && (await page.evaluate(() => document.documentElement.dataset.theme)) === "light");
  await toggle.click();
  check("Bấm → aria-pressed=true, <html data-theme=dark>, lưu localStorage",
    (await toggle.getAttribute("aria-pressed")) === "true" && (await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("nouri.theme")].join())) === "dark,dark");
  await page.reload();
  check("Tải lại vẫn tối", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark" && (await toggle.getAttribute("aria-pressed")) === "true");

  // 4) Không nháy màu: chặn main.tsx → script inline vẫn đặt data-theme trước khi app chạy.
  const blocked = await ctx.newPage();
  await blocked.route("**/src/main.tsx*", (route) => route.abort());
  await blocked.goto(URL_, { waitUntil: "domcontentloaded" });
  check("Không nháy màu: data-theme đã đặt trước khi tải mã ứng dụng", (await blocked.evaluate(() => document.documentElement.dataset.theme)) === "dark");
  await blocked.close();

  // 5) Đọc/ghi khóa chế độ bị lỗi (bộ nhớ bị chặn/đầy): trang vẫn chạy, mặc định sáng, nút vẫn đổi được chế độ.
  //    (Chặn toàn bộ localStorage thì auth.storage.ts sập trước — lỗi có sẵn, ghi lại cho GĐ4.)
  const strict = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await strict.addInitScript(() => {
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (key) { if (key === "nouri.theme") throw new Error("SecurityError: blocked"); return getItem.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key === "nouri.theme") throw new Error("QuotaExceededError"); return setItem.call(this, key, value); };
  });
  const sp = await strict.newPage();
  const strictErrors = [];
  sp.on("pageerror", (e) => strictErrors.push(String(e)));
  await sp.goto(URL_);
  await sp.locator(".dev-ui-header .ui-icon-button").click();
  check("localStorage bị chặn: không lỗi, mặc định sáng, bấm vẫn sang tối",
    strictErrors.length === 0 && (await sp.evaluate(() => document.documentElement.dataset.theme)) === "dark", strictErrors.join(" | "));
  await strict.close();
  await toggle.click(); // trả về sáng

  // 6) Tab qua trang: mọi điểm dừng có outline/vòng focus nhìn thấy.
  await page.goto(URL_);
  await page.locator(".dev-ui-panel").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  const stops = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== "none";
      return { tag: el.tagName.toLowerCase(), name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 28), visible };
    });
    if (!info) break;
    stops.push(info);
  }
  const hidden = stops.filter((s) => !s.visible);
  check(`Tab: ${stops.length} điểm dừng, tất cả có focus nhìn thấy`, stops.length > 20 && hidden.length === 0, hidden.map((s) => `${s.tag} ${s.name}`).join("; "));

  // 7) Hộp xác nhận: focus vào Hủy, Tab không thoát khỏi hộp, Esc = hủy, trả focus; xác nhận.
  const trigger = page.locator('.dev-ui-panel[data-theme="light"] .ui-button--danger', { hasText: "Xóa thực đơn" });
  await trigger.click();
  const dialog = page.locator('.dev-ui-panel[data-theme="light"] dialog.ui-dialog');
  const focusText = () => page.evaluate(() => document.activeElement?.textContent?.trim());
  check("Mở hộp: có tiêu đề rõ hành động + đối tượng, focus ở nút Hủy",
    (await dialog.evaluate((d) => d.open)) && (await dialog.locator("h2").textContent()) === "Xóa thực đơn Tuần 44?" && (await focusText()) === "Hủy");
  await dialog.screenshot({ path: `${OUT}/hop-xac-nhan_sang.png` });
  const inside = [];
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Tab"); inside.push(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")) || document.activeElement === document.body)); }
  check("Tab trong hộp không ra ngoài trang", inside.every(Boolean));
  await page.keyboard.press("Escape");
  check("Esc đóng hộp = Hủy, focus về nút đã mở",
    !(await dialog.evaluate((d) => d.open)) && (await focusText()) === "Xóa thực đơn"
      && (await page.locator('.dev-ui-panel[data-theme="light"] [aria-live="polite"]').last().textContent()) === "Đã hủy, thực đơn vẫn còn.");
  await trigger.click();
  await dialog.getByRole("button", { name: "Xóa thực đơn" }).click();
  check("Bấm nút nguy hiểm = xác nhận", (await page.locator('.dev-ui-panel[data-theme="light"] [aria-live="polite"]').last().textContent()) === "Đã xóa thực đơn (mẫu).");
  const darkTrigger = page.locator('.dev-ui-panel[data-theme="dark"] .ui-button--danger', { hasText: "Xóa thực đơn" });
  await darkTrigger.click();
  await page.locator('.dev-ui-panel[data-theme="dark"] dialog.ui-dialog').screenshot({ path: `${OUT}/hop-xac-nhan_toi.png` });
  await page.keyboard.press("Escape");

  // 8) 320px không cuộn ngang; chip đổi aria-pressed.
  await page.setViewportSize({ width: 320, height: 800 });
  check("320px: không cuộn ngang", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  const chip = page.locator('.dev-ui-panel[data-theme="light"] .ui-chip', { hasText: "Món chay" });
  await chip.click();
  check("Chip: bấm → aria-pressed=true, số đếm nằm trong tên đọc", (await chip.getAttribute("aria-pressed")) === "true" && (await chip.textContent()) === "Món chay9");

  // 9) Kích thước vùng bấm ≥ 44px.
  const small = await page.evaluate(() => [...document.querySelectorAll(".ui-button, .ui-icon-button, .ui-chip, .ui-input")]
    .map((el) => el.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 44).length);
  check("Nút, chip, ô nhập cao ≥ 44px", small === 0, `${small} phần tử nhỏ hơn`);

  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nTổng: ${results.length - failed}/${results.length} đạt`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
