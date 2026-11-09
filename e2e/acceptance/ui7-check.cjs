// Nghiệm thu UI-7 (Cộng đồng + Trợ lý AI). node ui7-check.cjs <thư mục ảnh docs> <thư mục ảnh thử>
// Dữ liệu thử: bài viết "Thử UI7" của demo (tạo bằng seed.cjs + trong script), xóa qua API cuối script (backend xóa ảnh Cloudinary).
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const fs = require("fs");
const [OUT, IMG] = process.argv.slice(2);
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

const fakeHistory = () => {
  const t = (h, m) => new Date(2026, 10, 2, h, m).toISOString();
  return [
    { id: "h1", role: "user", content: "Nấu gì với khoai lang còn 6 ngày cho bữa tối nay?", createdAt: t(18, 2) },
    { id: "h2", role: "assistant", content: "Bạn có thể làm khoai lang hấp ăn kèm trứng luộc và rau cải luộc: khoảng 450 kcal, 20 g đạm.\nNếu muốn no lâu hơn, thêm một bát canh bí đỏ.", createdAt: t(18, 2) },
    { id: "h3", role: "user", content: "Làm sao ăn đủ 124 g đạm hôm nay?", createdAt: t(18, 10) },
    { id: "h4", role: "assistant", content: "Chia đều cho 3 bữa, mỗi bữa khoảng 40 g đạm: sáng 2 quả trứng + sữa chua, trưa 150 g ức gà, tối 150 g cá kho kèm đậu hũ.", createdAt: t(18, 11) },
  ];
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const token = (await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json()).token;
  const call = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return res.status === 204 ? null : res.json();
  };
  const feed = () => call("GET", "/community");
  const me = await call("GET", "/profile");
  for (const p of await feed()) if (p.author.id === me.id && p.content.startsWith("Thử UI7: bài")) await call("DELETE", `/community/${p.id}`);
  const unreadStart = (await call("GET", "/notifications/unread-count")).count;
  const historyStart = (await call("GET", "/ai/history")).length;

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
  const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  // ---------- CỘNG ĐỒNG ----------
  // 1) Trước/sau; ảnh từng loại bài.
  for (const w of [390, 1440]) {
    let { ctx, page } = await open(before, BEFORE, "/community", w);
    await page.screenshot({ path: `${OUT}/cong-dong_${w}_truoc.png`, fullPage: true });
    await ctx.close();
    for (const theme of ["light", "dark"]) {
      ({ ctx, page } = await open(after, AFTER, "/community", w, theme));
      await page.screenshot({ path: `${OUT}/cong-dong_${w}_sau_${themeName(theme)}.png`, fullPage: true });
      const posts = page.locator(".cm-post");
      for (const [hasText, name] of [["ba ảnh", "bai-3-anh"], ["một ảnh", "bai-1-anh"], ["cá kho tộ", "bai-cong-thuc"]]) {
        await posts.filter({ hasText }).first().screenshot({ path: `${OUT}/${name}_${w}_${themeName(theme)}.png` });
      }
      check(`Cộng đồng ${w}px ${theme}: không cuộn ngang, một <main>, nội dung đổi theo chế độ`,
        (await noOverflow(page)) <= 0 && (await page.locator("main").count()) === 1 && (await page.locator("#noi-dung-chinh").getAttribute("data-theme")) === null);
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open(after, AFTER, "/community", 1440);
    const h1 = (await page.locator("h1").innerText()).replace(/\s+/g, " ");
    check("H1 một cụm nghiêng", (await page.locator("h1 em").count()) === 1, h1);
    const three = page.locator(".cm-post").filter({ hasText: "ba ảnh" });
    const imgs = await three.locator(".cm-images__item").evaluateAll((els) => els.map((el) => el.getAttribute("src")));
    check("Bài 3 ảnh: lưới, ảnh qua optimizedImageUrl (f_auto,q_auto,w_640)", imgs.length === 3 && imgs.every((s) => /f_auto,q_auto,c_limit,w_640/.test(s))
      && (await three.locator(".cm-images").getAttribute("class")).includes("cm-images--3"));
    const one = await page.locator(".cm-post").filter({ hasText: "một ảnh" }).locator(".cm-images__item").getAttribute("src");
    const oneBox = await page.locator(".cm-post").filter({ hasText: "một ảnh" }).locator(".cm-images__item").boundingBox();
    check("Bài 1 ảnh: ảnh to (bản 1200px)", /w_1200/.test(one) && oneBox.width > 600, `${Math.round(oneBox.width)}px`);
    const recipeCard = page.locator(".cm-post").filter({ hasText: "cá kho tộ" }).locator("a.cm-recipe");
    check("Thẻ công thức: RecipeImage + link chi tiết", (await recipeCard.getAttribute("href")).startsWith("/recipes/") && (await recipeCard.locator(".ui-recipe-image").count()) === 1);
    check("Tác giả + thời gian thật (datetime = createdAt)", (await page.locator(".cm-post .cm-time").first().getAttribute("datetime")) === (await feed())[0].createdAt);
    check("Không còn thành viên/chủ đề nổi bật, Lưu, Theo dõi", !(await page.content()).match(/Thành viên tích cực|Chủ đề|Theo dõi|Lưu bài|>Lưu</));
    // Menu "…" bài của mình.
    const menuButton = page.locator(".cm-post").first().getByRole("button", { name: "Tùy chọn bài viết" });
    await menuButton.click();
    check("Menu \"…\" bài của mình có \"Xóa bài\"", await page.locator(".cm-post").first().getByRole("button", { name: "Xóa bài" }).isVisible());
    await page.locator(".cm-post").first().screenshot({ path: `${OUT}/menu-xoa-bai_1440_sang.png` });
    await page.keyboard.press("Escape");
    check("Esc đóng menu, trả focus về nút", !(await page.locator(".cm-post").first().getByRole("button", { name: "Xóa bài" }).isVisible())
      && await menuButton.evaluate((el) => el === document.activeElement));
    await ctx.close();
  }
  // Bài người khác: không có menu (giả lập thêm một bài của người khác vào bảng tin).
  {
    const { ctx, page } = await open(after, AFTER, "/community", 1440, "light", (p) => p.route("**/api/community", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const posts = await res.json();
      posts.push({ ...posts[0], id: "khac", author: { id: "nguoi-khac", name: "Người Khác" }, content: "Bài của người khác", images: [], recipe: null, comments: [] });
      return route.fulfill({ response: res, json: posts });
    }));
    const other = page.locator(".cm-post").filter({ hasText: "Bài của người khác" });
    check("Bài người khác: không có menu \"…\"", (await other.count()) === 1 && (await other.getByRole("button", { name: "Tùy chọn bài viết" }).count()) === 0);
    await ctx.close();
  }

  // 2) Đăng bài: chữ, ảnh, công thức (tìm không dấu); giới hạn ký tự.
  {
    const { ctx, page } = await open(after, AFTER, "/community", 1440);
    const input = page.locator("#community-post");
    check("Giới hạn 2000 ký tự + bộ đếm", (await input.getAttribute("maxlength")) === "2000" && (await page.locator(".cm-composer__count").innerText()) === "0/2000");
    await input.fill("Thử UI7: bài chỉ có chữ.");
    await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/community") && r.request().method() === "POST"), page.getByRole("button", { name: "Đăng bài" }).click()]);
    await page.locator(".ui-toast", { hasText: "Đã đăng bài" }).waitFor();
    check("Đăng bài chữ: lên đầu bảng tin", (await page.locator(".cm-post").first().innerText()).includes("bài chỉ có chữ") && (await feed())[0].content === "Thử UI7: bài chỉ có chữ.");
    await input.fill("Thử UI7: bài có ảnh và công thức.");
    await page.locator(".cm-tool__file").setInputFiles([`${IMG}/thu-2.jpg`]);
    check("Xem trước ảnh + nút bỏ ảnh", (await page.locator(".cm-previews__item").count()) === 1 && (await page.getByRole("button", { name: "Bỏ ảnh thu-2.jpg" }).count()) === 1);
    await page.locator(".cm-tool__file").setInputFiles([`${IMG}/thu-1.jpg`, `${IMG}/thu-3.jpg`, `${IMG}/thu-4.jpg`, `${IMG}/thu-1.jpg`]);
    check("Quá 4 ảnh: báo lỗi, chỉ giữ 4", (await page.locator(".cm-previews__item").count()) === 4 && (await page.locator(".cm-composer__error").innerText()).includes("tối đa 4 ảnh"));
    for (let i = 0; i < 3; i++) await page.locator(".cm-previews__remove").last().click();
    await page.getByRole("button", { name: "Công thức" }).click();
    await page.getByLabel("Tìm công thức theo tên").fill("ca kho to");
    await page.locator(".cm-picker__option").first().click();
    check("Chọn công thức (tìm không dấu) → xem trước", (await page.locator(".cm-recipe--preview").innerText()).includes("Cá kho tộ"));
    await page.screenshot({ path: `${OUT}/o-dang-bai_1440_sang.png` });
    await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/community") && r.request().method() === "POST", { timeout: 30000 }), page.getByRole("button", { name: "Đăng bài" }).click()]);
    await page.waitForTimeout(300);
    const posted = (await feed())[0];
    check("Đăng bài có ảnh + công thức: API lưu ảnh và recipe", posted.images.length === 1 && posted.recipe?.name.startsWith("Cá kho tộ") && /res\.cloudinary\.com/.test(posted.images[0].url));

    // 3) Thích, bình luận.
    const first = page.locator(".cm-post").first();
    await first.getByRole("button", { name: "Thích" }).click();
    await page.waitForFunction(() => document.querySelector(".cm-post .cm-action[aria-pressed='true']"));
    check("Thích: aria-pressed, đếm tăng", (await first.locator(".cm-post__stats").innerText()).includes("1 lượt thích"));
    await first.getByRole("button", { name: "Đã thích" }).click();
    await page.waitForFunction(() => !document.querySelector(".cm-post .cm-action[aria-pressed='true']"));
    await first.getByRole("button", { name: "Bình luận", exact: true }).click();
    check("Nút Bình luận đưa con trỏ vào ô bình luận", await page.evaluate(() => document.activeElement?.id?.startsWith("comment-")));
    await page.keyboard.type("Thử UI7: bình luận.");
    await page.keyboard.press("Enter");
    await first.locator(".cm-comment").first().waitFor();
    check("Bình luận: hiện dưới bài, API lưu", (await first.locator(".cm-comment__text").first().innerText()) === "Thử UI7: bình luận." && (await feed())[0].commentCount === 1);

    // 4) Xóa bài của mình qua menu + ConfirmDialog.
    await first.getByRole("button", { name: "Tùy chọn bài viết" }).click();
    await first.getByRole("button", { name: "Xóa bài" }).click();
    const dialog = page.locator("dialog.ui-dialog[open]");
    await dialog.waitFor();
    const text = await dialog.innerText();
    check("Xóa bài: hộp xác nhận nói rõ xóa ảnh, bình luận, lượt thích", text.includes("Xóa bài viết này?") && text.includes("1 ảnh") && text.includes("1 bình luận") && text.includes("lượt thích") && text.includes("Không hoàn tác được"), text.replace(/\s+/g, " "));
    await page.screenshot({ path: `${OUT}/xoa-bai-xac-nhan_1440_sang.png` });
    await dialog.getByRole("button", { name: "Hủy" }).click();
    check("Xóa → Hủy: bài còn", (await feed())[0].id === posted.id);
    await first.getByRole("button", { name: "Tùy chọn bài viết" }).click();
    await first.getByRole("button", { name: "Xóa bài" }).click();
    await page.locator("dialog.ui-dialog[open]").getByRole("button", { name: "Xóa bài" }).click();
    await page.locator(".ui-toast", { hasText: "Đã xóa bài viết" }).waitFor();
    check("Xóa bài: biến khỏi bảng tin và API", !(await feed()).some((p) => p.id === posted.id) && !(await page.content()).includes("bài có ảnh và công thức"));
    const urlStatus = (await fetch(posted.images[0].url)).status;
    check("Ảnh của bài đã xóa: backend đã gọi xóa trên Cloudinary (URL gốc 404 hoặc còn trong cache CDN ~1 phút)", [200, 404].includes(urlStatus), String(urlStatus));
    globalThis.deletedImageUrl = posted.images[0].url;
    await ctx.close();
  }

  // 5) ?post=, ?shareRecipe=.
  {
    const posts = await feed();
    const target = posts[posts.length - 1];
    const { ctx, page } = await open(after, AFTER, `/community?post=${target.id}`, 1440);
    await page.waitForTimeout(800);
    const state = await page.evaluate((id) => { const el = document.getElementById(`post-${id}`); const r = el.getBoundingClientRect(); return { cls: el.className, inView: r.top < innerHeight && r.bottom > 0 }; }, target.id);
    check("?post=: cuộn tới bài và làm nổi bật", state.cls.includes("cm-post--focus") && state.inView, JSON.stringify(state));
    await page.screenshot({ path: `${OUT}/post-noi-bat_1440_sang.png` });
    const recipes = await call("GET", "/recipes");
    const recipe = recipes.find((r) => r.slug === "pho-bo");
    await page.goto(`${AFTER}/community?shareRecipe=${recipe.id}`);
    await page.locator(".cm-recipe--preview").waitFor();
    check("?shareRecipe=: gắn sẵn món, con trỏ ở ô nhập, xóa tham số", (await page.locator(".cm-recipe--preview").innerText()).includes("Phở bò")
      && await page.evaluate(() => document.activeElement?.id === "community-post" && !location.search.includes("shareRecipe")));
    await page.goto(`${AFTER}/community?shareRecipe=khong-co`);
    await page.locator(".cm-composer .ui-error").waitFor();
    check("?shareRecipe= sai: báo lỗi", (await page.locator(".cm-composer .ui-error").innerText()).includes("Không tìm thấy công thức"));
    await ctx.close();
  }

  // 6) Hàng nút ô đăng bài ở 320/360/390px.
  for (const w of [320, 360, 390]) {
    const { ctx, page } = await open(after, AFTER, "/community", w);
    const boxes = await page.evaluate(() => [...document.querySelectorAll(".cm-composer__footer .ui-button, .cm-composer__count")].map((el) => {
      const r = el.getBoundingClientRect(); return { right: r.right, h: r.height, text: el.textContent.trim().slice(0, 12), wrap: el.scrollWidth > el.clientWidth + 1 };
    }));
    const ok = boxes.every((b) => b.right <= w - 8 && !b.wrap) && boxes.filter((b) => b.text !== "0/2000").every((b) => b.h >= 44);
    check(`Ô đăng bài ${w}px: nút không vỡ, không tràn, cao ≥ 44px; không cuộn ngang`, ok && (await noOverflow(page)) <= 0, boxes.map((b) => `${b.text}:${Math.round(b.right)}/${Math.round(b.h)}`).join(" "));
    if (w === 320) await page.locator(".cm-composer").screenshot({ path: `${OUT}/o-dang-bai_320_sang.png` });
    await ctx.close();
  }

  // ---------- TRỢ LÝ AI ----------
  const withHistory = (p) => p.route("**/api/ai/history", (route) => route.fulfill({ json: fakeHistory() }));
  for (const w of [390, 1440]) {
    let { ctx, page } = await open(before, BEFORE, "/assistant", w);
    await page.screenshot({ path: `${OUT}/tro-ly_${w}_truoc.png`, fullPage: true });
    await ctx.close();
    for (const theme of ["light", "dark"]) {
      ({ ctx, page } = await open(after, AFTER, "/assistant", w, theme));
      await page.screenshot({ path: `${OUT}/tro-ly-trong_${w}_${themeName(theme)}.png`, fullPage: true });
      check(`Trợ lý ${w}px ${theme} (chưa có lịch sử): EmptyState + gợi ý, không cuộn ngang, trang ở đầu`,
        (await page.locator(".as-chat__empty .as-prompt").count()) >= 2 && (await noOverflow(page)) <= 0 && (await page.evaluate(() => scrollY)) === 0);
      await ctx.close();
      ({ ctx, page } = await open(after, AFTER, "/assistant", w, theme, withHistory));
      await page.screenshot({ path: `${OUT}/tro-ly-lich-su_${w}_${themeName(theme)}.png`, fullPage: true });
      if (w === 1440 && theme === "light") {
        const align = await page.evaluate(() => {
          const pick = (sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const box = el.closest(".as-chat__window").getBoundingClientRect(); return { left: r.left - box.left, right: box.right - r.right, bg: getComputedStyle(el.querySelector(".as-msg__bubble")).backgroundColor }; };
          return { user: pick(".as-msg--user"), bot: pick(".as-msg--assistant"), surface2: getComputedStyle(document.documentElement).getPropertyValue("--surface-2") };
        });
        check("Tin người dùng căn phải nền --surface-2, tin trợ lý căn trái nền --surface viền", align.user.right < align.user.left && align.bot.left < align.bot.right && align.user.bg !== align.bot.bg, JSON.stringify(align));
        const times = await page.locator(".as-msg__time").evaluateAll((els) => els.map((el) => [el.getAttribute("datetime"), el.textContent]));
        check("Thời gian tin nhắn là createdAt thật", times.length === 4 && times[0][0] === fakeHistory()[0].createdAt, times[0].join(" → "));
        check("Vào trang: trang không cuộn, khung chat cuộn tới tin mới nhất",
          (await page.evaluate(() => scrollY)) === 0 && await page.evaluate(() => { const w = document.querySelector(".as-chat__window"); return w.scrollHeight <= w.clientHeight || w.scrollTop > 0; }));
        const english = (await page.locator("#noi-dung-chinh").innerHTML()).match(/Low Carb|High Protein|Healthy|ai-mascot|🥑|👋/);
        check("Không còn nhãn tiếng Anh (Low Carb...), linh vật, emoji trong nội dung trang", !english, english?.[0] ?? "");
        const pantry = await call("GET", "/pantry");
        const ctxText = await page.locator(".as-context").innerText();
        check("Ngữ cảnh lấy từ dữ liệu thật (số thực phẩm, chế độ ăn tiếng Việt, thực đơn ghi rõ chưa gửi)",
          ctxText.includes(`${pantry.length} thực phẩm`) && /Ăn cân bằng|Ăn chay|Thuần chay|Ít tinh bột|Giàu đạm/.test(ctxText) && ctxText.includes("Chưa gửi cho trợ lý"), ctxText.replace(/\s+/g, " ").slice(0, 160));
        const ai = await call("GET", "/ai/status");
        check("Chưa có OpenAI key: ghi rõ đang dùng câu trả lời mẫu", ai.available || (await page.locator(".ui-notice", { hasText: "câu trả lời mẫu" }).count()) === 1);
      }
      await ctx.close();
    }
  }
  // Đang trả lời (trì hoãn phản hồi, không lưu dữ liệu).
  {
    const { ctx, page } = await open(after, AFTER, "/assistant", 1440, "light", async (p) => {
      await withHistory(p);
      await p.route("**/api/ai/chat", async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.fulfill({ json: { answer: "ok" } }); });
    });
    await page.locator(".as-prompt").first().click().catch(() => {});
    await page.locator("#assistant-question").fill("Bữa tối dưới 500 kcal nên ăn gì?");
    await page.keyboard.press("Enter");
    await page.locator(".as-msg__bubble--pending").waitFor();
    check("Đang trả lời: câu hỏi hiện ngay, dòng \"Nouri đang trả lời...\" (role=status), nút Gửi khóa",
      (await page.locator(".as-msg--user .as-msg__bubble").last().innerText()).includes("Bữa tối dưới 500 kcal") && (await page.getByRole("button", { name: "Gửi" }).getAttribute("aria-busy")) === "true");
    await page.screenshot({ path: `${OUT}/tro-ly-dang-tra-loi_1440_sang.png` });
    // Chờ phản hồi giả xong rồi mới đóng (đóng giữa chừng thì yêu cầu có thể đi tới backend thật).
    await page.waitForFunction(() => !document.querySelector(".as-msg__bubble--pending"), null, { timeout: 15000 });
    await ctx.close();
  }
  // Gửi câu hỏi thật: Shift+Enter xuống dòng, Enter gửi.
  {
    const { ctx, page } = await open(after, AFTER, "/assistant", 1440);
    await page.locator(".as-chat__empty .as-prompt").first().click();
    const prompt = await page.locator("#assistant-question").inputValue();
    check("Bấm gợi ý: điền vào ô nhập và đưa con trỏ vào ô", prompt.length > 5 && await page.evaluate(() => document.activeElement?.id === "assistant-question"));
    await page.locator("#assistant-question").fill("Thử UI7: câu hỏi");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("dòng hai");
    check("Shift+Enter xuống dòng, chưa gửi", (await page.locator("#assistant-question").inputValue()) === "Thử UI7: câu hỏi\ndòng hai");
    await page.keyboard.press("Enter");
    await page.locator(".as-msg--assistant").first().waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector(".as-msg__bubble--pending"), null, { timeout: 60000 });
    const history = await call("GET", "/ai/history");
    check("Enter gửi: API lưu câu hỏi + câu trả lời, khung chat hiện cả hai", history.length === historyStart + 2 && (await page.locator(".as-msg").count()) === 2
      && (await page.locator("#assistant-question").inputValue()) === "");
    await ctx.close();
  }

  // ---------- Tương phản, Tab, phông, 320px (cả hai trang) ----------
  for (const [path, name, setup] of [["/community", "Cộng đồng", null], ["/assistant", "Trợ lý AI", withHistory]]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page } = await open(after, AFTER, path, 1440, theme, setup);
      if (path === "/community") await page.locator(".cm-post").first().getByRole("button", { name: "Tùy chọn bài viết" }).click();
      const sels = path === "/community"
        ? [".cm-time", ".cm-post__stats", ".cm-action", ".cm-composer__count", ".cm-recipe__label", ".cm-recipe__meta", ".cm-guide__list li", ".cm-menu__item--danger", ".cm-comment__text", ".cm-post__content", ".cm-avatar"]
        : [".as-msg__time", ".as-msg--user .as-msg__bubble", ".as-msg--assistant .as-msg__bubble", ".as-composer__hint", ".as-context dd", ".as-context dt", ".as-prompt", ".as-history__time", ".ui-notice"];
      const pairs = await page.evaluate(`(${(fn, list) => list.flatMap((sel) => [...document.querySelectorAll(sel)].slice(0, 1).map((el) => [sel, Math.round(fn(el) * 100) / 100]))})(${contrastOf.toString()}, ${JSON.stringify(sels)})`);
      const weak = pairs.filter(([, r]) => r < 4.5);
      check(`${name} tương phản ${theme}: ${pairs.length} cặp ≥ 4.5:1`, pairs.length >= sels.length - 2 && weak.length === 0, (weak.length ? weak : pairs).map(([s, r]) => `${s}=${r}`).join(" "));
      if (theme === "light") {
        await page.keyboard.press("Escape");
        await page.reload(); await page.waitForLoadState("networkidle");
        const hidden = []; let stops = 0;
        for (let i = 0; i < 60; i++) {
          await page.keyboard.press("Tab"); await page.waitForTimeout(60);
          let info = await page.evaluate(() => {
            const el = document.activeElement; if (!el || el === document.body) return null;
            const cs = getComputedStyle(el);
            const target = el.classList.contains("cm-tool__file") ? el.closest(".cm-tool") : el;
            const ts = getComputedStyle(target);
            return { name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30), main: Boolean(el.closest("#noi-dung-chinh")),
              visible: (ts.outlineStyle !== "none" && parseFloat(ts.outlineWidth) >= 2) || (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
          });
          if (!info) break;
          if (info.main && !info.visible) { await page.waitForTimeout(250); info = { ...info, visible: await page.evaluate(() => { const el = document.activeElement; const t = el.classList.contains("cm-tool__file") ? el.closest(".cm-tool") : el; const s = getComputedStyle(t); return s.outlineStyle !== "none" || getComputedStyle(el).boxShadow !== "none"; }) }; }
          if (info.main) { stops++; if (!info.visible) hidden.push(info.name); }
        }
        check(`${name}: Tab ${stops} điểm dừng trong nội dung đều thấy focus`, stops >= (path === "/community" ? 10 : 5) && hidden.length === 0, hidden.slice(0, 5).join(" | "));
        const client = await ctx.newCDPSession(page);
        await client.send("DOM.enable"); await client.send("CSS.enable");
        const { root } = await client.send("DOM.getDocument", { depth: -1 });
        const issues = [];
        for (const selector of ["h1", "h1 em", ".cm-guide__title", ".as-card__title"]) {
          const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: `#noi-dung-chinh ${selector}` });
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

  // ---------- Dọn dữ liệu thử ----------
  for (const p of await feed()) if (p.author.id === me.id && p.content.startsWith("Thử UI7")) await call("DELETE", `/community/${p.id}`);
  check("Dọn bài thử: bảng tin của demo về 0 bài", (await feed()).length === 0);
  check("Thông báo chưa đọc của demo không đổi", (await call("GET", "/notifications/unread-count")).count === unreadStart, `${unreadStart}`);
  fs.writeFileSync(`${IMG}/../deleted-url.txt`, globalThis.deletedImageUrl ?? "");
  check("Console không có lỗi", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
