// Nghiệm thu UI-5 (Kho thực phẩm + hộp thoại Thêm/Sửa). node ui5-check.cjs <thư mục ảnh docs>
// Dữ liệu thử: thực phẩm tên bắt đầu "Thử UI5", tạo/xóa qua API, cuối script xóa sạch.
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const [OUT] = process.argv.slice(2);
const AFTER = "http://localhost:5173";
const BEFORE = "http://localhost:8080";
const API = "http://localhost:4000/api";
const PREFIX = "Thử UI5";
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

const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const display = (days) => { const [y, m, d] = iso(days).split("-"); return `${d}/${m}/${y}`; };

// Tỉ lệ tương phản WCAG giữa màu chữ và nền thực tế (đi lên tổ tiên tới khi gặp nền không trong suốt).
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
  const pantry = () => call("GET", "/pantry");
  const cleanup = async () => { for (const item of await pantry()) if (item.name.startsWith(PREFIX)) await call("DELETE", `/pantry/${item.id}`); };
  await cleanup();
  const startCount = (await pantry()).length;

  const after = await sessionFor(browser, AFTER);
  const before = await sessionFor(browser, BEFORE);
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

  // 1) Ảnh trước (8080, bản main) / sau (5173): 390 & 1440, sáng & tối. Không cuộn ngang, chỉ một <main>.
  for (const w of [390, 1440]) {
    let { ctx, page } = await open(before, BEFORE, "/pantry", w);
    await page.screenshot({ path: `${OUT}/kho_${w}_truoc.png`, fullPage: true });
    await ctx.close();
    for (const theme of ["light", "dark"]) {
      ({ ctx, page } = await open(after, AFTER, "/pantry", w, theme));
      await page.screenshot({ path: `${OUT}/kho_${w}_sau_${themeName(theme)}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const mains = await page.locator("main").count();
      check(`Kho ${w}px ${theme}: không cuộn ngang, một <main>, nội dung đổi theo chế độ`,
        overflow <= 0 && mains === 1 && (await page.locator("#noi-dung-chinh").getAttribute("data-theme")) === null, `${overflow}px, main=${mains}`);
      if (w === 390) {
        const rows = await page.locator(".kho-row").evaluateAll((els) => els.map((el) => ({ display: getComputedStyle(el).display, right: el.getBoundingClientRect().right })));
        check(`Kho 390px ${theme}: bảng thành thẻ, không dòng nào tràn khung`, rows.length > 0 && rows.every((r) => r.display === "grid" && r.right <= 390), JSON.stringify(rows[0]));
      }
      await ctx.close();
    }
  }

  // 2) Hộp thoại: ảnh thêm / sửa / lỗi trường ở 390 & 1440, sáng & tối; khóa focus, Esc, trả focus.
  for (const w of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(after, AFTER, "/pantry", w, theme);
      const addButton = page.locator(".kho-hero").getByRole("button", { name: "Thêm thực phẩm" });
      await addButton.click();
      const dialog = page.locator("dialog.kho-dialog");
      await dialog.waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/kho-them_${w}_${themeName(theme)}.png` });
      await dialog.getByLabel("Hạn sử dụng").fill("32/11/2026");
      await dialog.getByRole("button", { name: "Lưu vào kho" }).click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/kho-them-loi_${w}_${themeName(theme)}.png` });
      if (w === 1440 && theme === "light") {
        const fields = await dialog.locator("[aria-invalid='true']").evaluateAll((els) => els.map((el) => ({
          label: document.querySelector(`label[for="${el.id}"]`)?.textContent,
          error: (el.getAttribute("aria-describedby") || "").split(" ").map((id) => document.getElementById(id)?.textContent).join(" | "),
          focused: el === document.activeElement,
        })));
        check("Lỗi trường: hiện ngay dưới trường, liên kết aria-describedby, nói cách sửa", fields.length === 2
          && fields[0].label === "Tên thực phẩm" && /Nhập tên thực phẩm/.test(fields[0].error)
          && fields[1].label === "Hạn sử dụng" && /dd\/mm\/yyyy/.test(fields[1].error), JSON.stringify(fields));
        check("Lỗi trường: focus về trường sai đầu tiên", fields[0]?.focused);
        const inside = [];
        for (let i = 0; i < 16; i++) { await page.keyboard.press("Tab"); inside.push(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")))); }
        check("Hộp thoại khóa focus (16 lần Tab vẫn ở trong hộp)", inside.every(Boolean));
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);
        check("Esc đóng hộp thoại và trả focus về nút Thêm thực phẩm", (await dialog.count()) === 0
          && await page.evaluate(() => document.activeElement?.textContent?.includes("Thêm thực phẩm")));
      }
      if (w === 390) {
        await page.setViewportSize({ width: 320, height: 700 });
        await page.waitForTimeout(250);
        const box = await page.locator("dialog.kho-dialog").boundingBox().catch(() => null);
        if (theme === "light") check("Hộp thoại 320px nằm gọn trong màn hình", box && box.x >= 0 && box.x + box.width <= 320, box ? `${Math.round(box.x)}+${Math.round(box.width)}` : "đã đóng");
      }
      await ctx.close();
    }
  }

  // 3) Thêm qua giao diện: đúng trường, nơi bảo quản (radio), DateInput, thông báo đúng động từ.
  const name = `${PREFIX} Cải bó xôi`;
  {
    const { ctx, page } = await open(after, AFTER, "/pantry", 1440);
    await page.locator(".kho-hero").getByRole("button", { name: "Thêm thực phẩm" }).click();
    const dialog = page.locator("dialog.kho-dialog");
    await dialog.getByLabel("Tên thực phẩm").fill(name);
    await dialog.getByLabel("Nhóm").selectOption("Rau củ");
    await dialog.getByLabel("Hạn sử dụng").fill(display(2));
    await dialog.getByLabel("Số lượng").fill("2");
    await dialog.getByLabel("Đơn vị").selectOption("PACKAGE");
    await dialog.getByLabel("Tồn kho tối thiểu").fill("1");
    await dialog.getByRole("radio", { name: "Ngăn đông" }).check();
    check("Nơi bảo quản là nhóm radio 3 lựa chọn", (await dialog.getByRole("radio").count()) === 3);
    await dialog.getByRole("button", { name: "Lưu vào kho" }).click();
    await page.locator(".ui-toast").waitFor();
    check("Thêm: thông báo \"Đã lưu … vào kho.\"", (await page.locator(".ui-toast").innerText()).trim() === `Đã lưu “${name}” vào kho.`);
    const saved = (await pantry()).find((item) => item.name === name);
    check("Thêm: API lưu đúng các trường", saved && saved.storageLocation === "FREEZER" && saved.unit === "PACKAGE" && saved.quantity === 2
      && saved.minimumStock === 1 && saved.expiryDate?.slice(0, 10) === iso(2), JSON.stringify(saved));
    const row = page.locator(`#pantry-item-${saved?.id}`);
    check("Thêm: dòng mới sắp hết hạn có nền --warn-bg và \"Còn 2 ngày\"", (await row.getAttribute("class"))?.includes("kho-row--soon") && (await row.innerText()).includes("Còn 2 ngày"));

    // 4) Sửa: xóa trắng hạn dùng → lưu null.
    await row.getByRole("button", { name: `Sửa ${name}` }).click();
    const editDialog = page.locator("dialog.kho-dialog");
    check("Sửa: tiêu đề và nút \"Lưu thay đổi\", ngày điền sẵn dd/mm/yyyy",
      (await editDialog.locator("h2").innerText()) === "Sửa thực phẩm" && (await editDialog.getByLabel("Hạn sử dụng").inputValue()) === display(2)
      && (await editDialog.getByRole("button", { name: "Lưu thay đổi" }).count()) === 1);
    await editDialog.getByLabel("Hạn sử dụng").fill("");
    await editDialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    await page.waitForFunction((n) => document.querySelector(".ui-toast")?.textContent?.includes("Đã lưu thay đổi"), name);
    check("Sửa: thông báo \"Đã lưu thay đổi cho …\"", (await page.locator(".ui-toast").innerText()).trim() === `Đã lưu thay đổi cho “${name}”.`);
    const edited = (await pantry()).find((item) => item.name === name);
    check("Sửa: xóa trắng hạn sử dụng → API lưu null", edited && edited.expiryDate === null, String(edited?.expiryDate));
    await ctx.close();
  }

  // Dữ liệu cho lọc/phân trang: 1 món dưới mức tối thiểu + 7 món còn tốt (tổng > 8 → 2 trang).
  const low = await call("POST", "/pantry", { name: `${PREFIX} Gạo`, category: "Ngũ cốc", quantity: 0.5, unit: "KG", storageLocation: "DRY_STORAGE", expiryDate: null, minimumStock: 1 });
  for (let i = 1; i <= 7; i++) await call("POST", "/pantry", { name: `${PREFIX} Món ${i}`, category: "Khác", quantity: i, unit: "ITEM", storageLocation: "REFRIGERATOR", expiryDate: iso(20 + i), minimumStock: 0 });

  // 5) Ô thống kê, chip, thanh lọc, phân trang, dạng lưới.
  {
    const { ctx, page } = await open(after, AFTER, "/pantry", 1440);
    const items = await pantry();
    const days = (item) => (item.expiryDate ? Math.round((new Date(item.expiryDate.slice(0, 10)) - new Date(iso(0))) / 86400000) : null);
    const expected = {
      "Tất cả": items.length,
      "Sắp hết hạn": items.filter((i) => days(i) !== null && days(i) >= 0 && days(i) <= 3).length,
      "Đã hết hạn": items.filter((i) => days(i) !== null && days(i) < 0).length,
      "Dưới mức tối thiểu": items.filter((i) => i.minimumStock > 0 && i.quantity <= i.minimumStock).length,
    };
    const stats = Object.fromEntries(await page.locator(".kho-stat").evaluateAll((els) => els.map((el) => [el.querySelector(".kho-stat__label").textContent, Number(el.querySelector(".kho-stat__value").textContent)])));
    check("4 ô thống kê: số khớp API", JSON.stringify(stats) === JSON.stringify(expected), JSON.stringify(stats));
    const stat = (label) => page.locator(".kho-stat", { hasText: label });
    await stat("Dưới mức tối thiểu").click();
    const lowRows = await page.locator(".kho-row").allInnerTexts();
    check("Bấm \"Dưới mức tối thiểu\": aria-pressed, chỉ còn món dưới mức, có cảnh báo",
      (await stat("Dưới mức tối thiểu").getAttribute("aria-pressed")) === "true" && lowRows.length === expected["Dưới mức tối thiểu"]
      && lowRows.some((t) => t.includes(`${PREFIX} Gạo`) && t.includes("Dưới mức tối thiểu 1 kg")), lowRows.length);
    await stat("Dưới mức tối thiểu").click();
    check("Bấm lại ô đang chọn → về Tất cả", (await stat("Tất cả").getAttribute("aria-pressed")) === "true");
    await stat("Sắp hết hạn").click();
    const statuses = await page.locator(".kho-row .kho-status").allInnerTexts();
    check("Bấm \"Sắp hết hạn\": chỉ còn dòng sắp hết hạn", statuses.length === expected["Sắp hết hạn"] && statuses.every((s) => s === "Sắp hết hạn"), statuses.join(","));
    await page.getByLabel("Tình trạng", { exact: true }).selectOption("good");
    check("Chọn \"Còn tốt\" ở thanh lọc: không ô thống kê nào được chọn", (await page.locator(".kho-stat[aria-pressed='true']").count()) === 0);
    await page.getByLabel("Tình trạng", { exact: true }).selectOption("all");
    const chip = page.locator(".kho-chips .ui-chip", { hasText: "Khác" });
    check("Chip nhóm có số thật", (await chip.locator(".ui-chip__count").innerText()) === String(items.filter((i) => i.category === "Khác").length));
    await chip.click();
    check("Chọn chip → aria-pressed, lọc theo nhóm", (await chip.getAttribute("aria-pressed")) === "true" && (await page.locator(".kho-row").count()) === items.filter((i) => i.category === "Khác").length);
    await page.locator(".kho-chips .ui-chip", { hasText: "Tất cả" }).click();
    await page.getByLabel("Nơi bảo quản", { exact: true }).selectOption("DRY_STORAGE");
    check("Lọc nơi bảo quản", (await page.locator(".kho-row").count()) === items.filter((i) => i.storageLocation === "DRY_STORAGE").length);
    await page.getByLabel("Nơi bảo quản", { exact: true }).selectOption("all");
    await page.getByLabel("Sắp xếp", { exact: true }).selectOption("name");
    const names = await page.locator(".kho-row .kho-name").allInnerTexts();
    check("Sắp xếp Tên A–Z", JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b, "vi"))));
    await page.getByLabel("Sắp xếp", { exact: true }).selectOption("expiry");
    await page.locator("#kho-search").fill("món");
    check("Tìm kiếm theo tên", (await page.locator(".kho-row").count()) === 7);
    await page.locator("#kho-search").fill("");
    check("Phân trang: 8 dòng trang 1", (await page.locator(".kho-row").count()) === 8 && (await page.locator(".kho-pager__count").innerText()) === `Hiển thị 1–8 trong ${items.length} thực phẩm`);
    await page.getByRole("button", { name: "Trang 2" }).click();
    check("Phân trang: sang trang 2", (await page.getByRole("button", { name: "Trang 2" }).getAttribute("aria-current")) === "page"
      && (await page.locator(".kho-pager__count").innerText()) === `Hiển thị 9–${items.length} trong ${items.length} thực phẩm`);
    await page.getByRole("button", { name: "Dạng lưới" }).click();
    check("Dạng lưới: hiện thẻ, nút aria-pressed", (await page.locator(".kho-tile").count()) > 0 && (await page.getByRole("button", { name: "Dạng lưới" }).getAttribute("aria-pressed")) === "true");
    await page.screenshot({ path: `${OUT}/kho-luoi_1440_sang.png`, fullPage: true });
    await ctx.close();
  }

  // 6) ?item= : đúng dòng ở trang 2, kể cả khi đang lọc; item không còn → dòng nhắc; "Cần dùng sớm" mở đúng dòng.
  {
    const { ctx, page } = await open(after, AFTER, `/pantry?item=${low.id}`, 1440);
    await page.waitForTimeout(800);
    const state = async () => page.evaluate((id) => {
      const el = document.getElementById(`pantry-item-${id}`);
      const r = el?.getBoundingClientRect();
      return { exists: Boolean(el), focused: el === document.activeElement, highlighted: el?.classList.contains("kho-item--focus"), inView: r ? r.top >= 0 && r.bottom <= innerHeight : false, url: location.search };
    }, low.id);
    let s = await state();
    check("?item=: mở đúng dòng ở trang 2, cuộn tới, focus, làm nổi bật, xóa tham số",
      s.exists && s.focused && s.highlighted && s.inView && s.url === "" && (await page.getByRole("button", { name: "Trang 2" }).getAttribute("aria-current")) === "page", JSON.stringify(s));
    await page.screenshot({ path: `${OUT}/kho-item-noi-bat_1440_sang.png` });
    // Đang lọc ở chỗ khác rồi bấm link thông báo (điều hướng trong ứng dụng).
    await page.locator(".kho-stat", { hasText: "Sắp hết hạn" }).click();
    await page.locator("#kho-search").fill("không khớp gì");
    await page.evaluate((id) => { history.pushState(history.state, "", `/pantry?item=${id}`); dispatchEvent(new PopStateEvent("popstate", { state: history.state })); }, low.id);
    await page.waitForTimeout(900);
    s = await state();
    check("?item= khi đang lọc: bỏ lọc rồi mở đúng dòng", s.exists && s.focused && s.inView && (await page.locator("#kho-search").inputValue()) === "", JSON.stringify(s));
    await page.evaluate(() => { history.pushState(history.state, "", "/pantry?item=khong-con"); dispatchEvent(new PopStateEvent("popstate", { state: history.state })); });
    await page.waitForTimeout(500);
    check("?item= không còn: dòng nhắc \"Thực phẩm này không còn trong kho.\", xóa tham số",
      (await page.locator(".ui-notice").innerText()).includes("Thực phẩm này không còn trong kho.") && (await page.evaluate(() => location.search)) === "");
    await page.locator(".ui-notice").getByRole("button", { name: "Đóng" }).click();
    const soon = page.locator(".kho-soon__item").first();
    const soonName = (await soon.locator(".kho-soon__name").evaluate((el) => el.firstChild.textContent)).trim();
    await soon.click();
    await page.waitForTimeout(700);
    const focused = await page.evaluate(() => ({ id: document.activeElement?.id, name: document.activeElement?.querySelector(".kho-name")?.textContent }));
    check("\"Cần dùng sớm\": bấm món mở đúng dòng", focused.name === soonName && focused.id.startsWith("pantry-item-"), JSON.stringify(focused));
    const cook = await page.locator(".kho-cook__name").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    check("\"Nấu gì từ kho?\": liên kết tới công thức thật", cook.length > 0 && cook.every((href) => /^\/recipes\/c[a-z0-9]+$/.test(href)), cook.join(","));
    await ctx.close();
  }

  // 7) Xóa: ConfirmDialog nêu tên; Hủy giữ lại; Xóa → thông báo.
  {
    const { ctx, page } = await open(after, AFTER, "/pantry", 1440);
    await page.locator("#kho-search").fill(name);
    await page.getByRole("button", { name: `Xóa ${name}` }).click();
    const confirm = page.locator("dialog.ui-dialog[open]").filter({ hasText: "Xóa thực phẩm" });
    await confirm.waitFor();
    check("Xóa: hộp xác nhận nêu tên thực phẩm, nút ghi đúng hành động", (await confirm.locator("h2").innerText()) === `Xóa “${name}” khỏi kho?`);
    await page.screenshot({ path: `${OUT}/kho-xoa_1440_sang.png` });
    await confirm.getByRole("button", { name: "Hủy" }).click();
    check("Xóa → Hủy: thực phẩm còn nguyên", (await pantry()).some((i) => i.name === name));
    await page.getByRole("button", { name: `Xóa ${name}` }).click();
    await page.locator("dialog.ui-dialog[open]").getByRole("button", { name: "Xóa thực phẩm" }).click();
    await page.locator(".ui-toast").waitFor();
    check("Xóa: thông báo \"Đã xóa … khỏi kho.\" và API không còn", (await page.locator(".ui-toast").innerText()).trim() === `Đã xóa “${name}” khỏi kho.` && !(await pantry()).some((i) => i.name === name));
    await ctx.close();
  }

  // 8) Tương phản các cặp màu mới (sáng/tối), Tab, phông, 320px.
  await call("POST", "/pantry", { name: `${PREFIX} Sữa chua`, category: "Trứng & sữa", quantity: 4, unit: "ITEM", storageLocation: "REFRIGERATOR", expiryDate: iso(1), minimumStock: 0 });
  for (const theme of ["light", "dark"]) {
    const { ctx, page } = await open(after, AFTER, "/pantry", 1440, theme);
    const pairs = await page.evaluate(`(${(fn) => {
      const pick = (sel) => [...document.querySelectorAll(sel)].slice(0, 1);
      const sels = [".kho-status--good", ".kho-status--expiring", ".kho-status--expired", ".kho-row--soon .kho-sub--warn", ".kho-row--soon .kho-sub",
        ".kho-sub--warn", ".kho-stat__value--alert", ".kho-stat__note", ".kho-stat[aria-pressed='true'] .kho-stat__note", ".kho-toolbar__label", ".kho-pager__count",
        ".kho-soon__when", ".kho-soon__qty", ".kho-cook__note", ".kho-table th", ".kho-row--soon td"];
      return sels.flatMap((sel) => pick(sel).map((el) => [sel, Math.round(fn(el) * 100) / 100]));
    }})(${contrastOf.toString()})`);
    const weak = pairs.filter(([, ratio]) => ratio < 4.5);
    check(`Tương phản chữ ${theme}: ${pairs.length} cặp đều ≥ 4.5:1`, pairs.length >= 14 && weak.length === 0, (weak.length ? weak : pairs).map(([s, r]) => `${s}=${r}`).join(" "));
    if (theme === "light") {
      const hidden = []; let stops = 0;
      for (let i = 0; i < 70; i++) {
        await page.keyboard.press("Tab"); await page.waitForTimeout(30);
        const info = await page.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          return { name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30), main: Boolean(el.closest("#noi-dung-chinh")),
            visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
        });
        if (!info) break;
        if (info.main) { stops++; if (!info.visible) hidden.push(info.name); }
      }
      check(`Tab ${stops} điểm dừng trong nội dung đều thấy focus`, stops >= 25 && hidden.length === 0, hidden.join(" | "));
      const client = await ctx.newCDPSession(page);
      await client.send("DOM.enable"); await client.send("CSS.enable");
      const { root } = await client.send("DOM.getDocument", { depth: -1 });
      const issues = [];
      for (const selector of ["h1", "h1 em", ".kho-side__title", ".kho-stat__value"]) {
        const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: `#noi-dung-chinh ${selector}` });
        for (const nodeId of nodeIds) {
          const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
          if (!fonts.every((f) => /Fraunces/.test(f.familyName) && f.isCustomFont)) issues.push(`${selector}: ${fonts.map((f) => f.familyName).join(",")}`);
        }
      }
      await page.locator(".kho-hero").getByRole("button", { name: "Thêm thực phẩm" }).click();
      const { root: root2 } = await client.send("DOM.getDocument", { depth: -1 });
      const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root2.nodeId, selector: "dialog .ui-dialog__form-title" });
      for (const nodeId of nodeIds) {
        const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
        if (!fonts.every((f) => /Fraunces|Be Vietnam Pro/.test(f.familyName) && f.isCustomFont)) issues.push(`dialog: ${fonts.map((f) => f.familyName).join(",")}`);
      }
      check("Tiêu đề (dấu chồng: Tủ bếp của bạn, Cần dùng sớm, Thêm thực phẩm) vẽ bằng phông đã nạp", issues.length === 0 && nodeIds.length === 1, issues.join("; "));
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 320, height: 800 });
      await page.waitForTimeout(300);
      check("320px không cuộn ngang", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
    }
    await ctx.close();
  }

  // 9) Trạng thái: đang tải, lỗi + Thử lại, kho trống (giả lập phản hồi API, không đổi dữ liệu).
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: after, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    let mode = "slow";
    await page.route("**/api/pantry", async (route) => {
      if (mode === "slow") { await new Promise((r) => setTimeout(r, 2500)); return route.fulfill({ json: [] }); }
      if (mode === "error") return route.fulfill({ status: 500, json: { message: "Lỗi thử" } });
      return route.fulfill({ json: [] });
    });
    page.goto(AFTER + "/pantry");
    await page.locator(".kho-view .ui-loading").waitFor();
    await page.screenshot({ path: `${OUT}/kho-dang-tai_1440_sang.png` });
    check("Đang tải: skeleton đúng hình trang", (await page.locator(".kho-view .ui-skeleton").count()) >= 4);
    await page.locator(".ui-empty").waitFor();
    check("Kho trống: một câu + nút Thêm thực phẩm", (await page.locator(".ui-empty__message").innerText()) === "Kho chưa có thực phẩm nào."
      && (await page.locator(".ui-empty").getByRole("button", { name: "Thêm thực phẩm" }).count()) === 1);
    await page.screenshot({ path: `${OUT}/kho-trong_1440_sang.png` });
    mode = "error";
    await page.reload();
    await page.locator(".kho-view .ui-error").waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/kho-loi_1440_sang.png` });
    mode = "empty";
    await page.getByRole("button", { name: "Thử lại" }).click();
    await page.locator(".ui-empty").waitFor();
    check("Lỗi tải: thông báo + Thử lại tải lại được", true);
    await ctx.close();
  }

  await cleanup();
  const endCount = (await pantry()).length;
  check("Dọn dữ liệu thử: kho demo về đúng số thực phẩm ban đầu", endCount === startCount, `${startCount} → ${endCount}`);
  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
