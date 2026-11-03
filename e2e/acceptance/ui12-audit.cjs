// UI-12: bộ ảnh cuối + rà soát tự động từng trang. node ui12-audit.cjs <thư mục ảnh> <nhóm: guest|demo|admin> [shots=1]
// Ghi kết quả vào audit-<nhóm>.json. Admin đọc từ .env (không in ra).
const ACC = require("./lib/env.cjs");
const fs = require("fs");
const { chromium } = require("playwright-core");
const admin = require("./lib/admin-env.cjs")();
const [OUT, GROUP, SHOTS = "1"] = process.argv.slice(2);
const APP = "http://localhost:5173";
const RID = fs.readFileSync("../ui12/rid.txt", "utf8").trim();
const PAGES = {
  guest: [["landing", "/"], ["dang-nhap", "/login"], ["dang-ky", "/login?mode=register"], ["chinh-sach", "/privacy"], ["dieu-khoan", "/terms"]],
  demo: [["tong-quan", "/dashboard"], ["kho", "/pantry"], ["thuc-don", "/meal-plans"], ["cong-thuc", "/recipes"], ["chi-tiet-cong-thuc", `/recipes/${RID}`],
    ["cong-dong", "/community"], ["tro-ly", "/assistant"], ["ho-so", "/profile"]],
  admin: [["admin-thong-ke", "/admin"], ["admin-cong-thuc", "/admin/recipes"], ["admin-sua-mon", `/admin/recipes/${RID}/edit`], ["admin-nguoi-dung", "/admin/users"],
    ["admin-kiem-duyet", "/admin/moderation"], ["admin-nhat-ky", "/admin/audit-logs"]],
};
const ENGLISH = /\b(dashboard|pantry|recipes?|meal ?plans?|healthy|low ?carb|high ?protein|eat clean|login|logout|log in|sign (in|up)|submit|cancel|save|delete|edit|search|loading|error|profile|settings|home|back|next|previous|upload|purchased|completed|expiry|scan|ocr|vegan|vegetarian|balanced|breakfast|lunch|dinner|snack|draft|active|user|password|admin)\b/gi;

function audit() {
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] > 0.9) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
  const hidden = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden" || n.classList.contains("ui-visually-hidden") || n.hasAttribute("hidden")) return true; } const r = el.getBoundingClientRect(); return r.width < 2 || r.height < 2; };
  const textEls = [...document.querySelectorAll("body *")].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !hidden(el) && !el.closest("svg, script, style, noscript, dialog:not([open])"));
  const contrast = []; const small = [];
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize); const weight = Number(cs.fontWeight);
    if (el.closest("[disabled], [aria-disabled='true']")) continue;
    const fg = parse(cs.color); const bg = bgOf(el);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); const ratio = (a + 0.05) / (b + 0.05);
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    if (ratio < need) contrast.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} "${el.textContent.trim().slice(0, 30)}" ${ratio.toFixed(2)}`);
    if (size < 13) small.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} ${size}px "${el.textContent.trim().slice(0, 30)}"`);
  }
  const text = document.body.innerText;
  const attrs = [...document.querySelectorAll("[aria-label], [title], [placeholder], img[alt]")].map((el) => [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("placeholder"), el.getAttribute("alt")].filter(Boolean).join(" ")).join(" | ");
  const footerBottom = document.querySelector(".site-footer__bottom")?.innerText ?? "";
  const all = [...document.querySelectorAll("body *")];
  const italic = all.filter((el) => getComputedStyle(el).fontStyle === "italic" && !hidden(el) && !el.closest(".ui-logo") && el.textContent.trim()).map((el) => el.className || el.tagName);
  const upper = all.filter((el) => getComputedStyle(el).textTransform === "uppercase" && !hidden(el) && el.textContent.trim()).map((el) => el.className);
  const primaries = [...document.querySelectorAll(".ui-button--primary")].filter((b) => !hidden(b)).map((b) => b.closest("section, form, header, aside, dialog, article")?.className || "page");
  return {
    contrast: contrast.slice(0, 8), contrastCount: contrast.length, small: small.slice(0, 8), smallCount: small.length, textCount: textEls.length,
    english: [...new Set([...(text + " " + attrs).matchAll(new RegExp(ENGLISH_SRC, "gi"))].map((m) => m[0]))],
    middot: (text.replace(footerBottom, "").match(/·/g) || []).length, arrow: text.includes("→"),
    emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text),
    gradient: all.filter((el) => /gradient\(/.test(getComputedStyle(el).backgroundImage)).length,
    blur: all.filter((el) => getComputedStyle(el).backdropFilter !== "none").length,
    animations: document.getAnimations().filter((a) => a.playState === "running").length,
    italic: italic.slice(0, 5), upper: upper.slice(0, 5),
    primaryDup: primaries.filter((p, i) => primaries.indexOf(p) !== i),
    h1: document.querySelectorAll("h1").length, mains: document.querySelectorAll("main").length,
  };
}

(async () => {
  const browser = await chromium.launch();
  let state;
  if (GROUP !== "guest") {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    await p.goto(APP + "/login");
    await p.getByLabel("Email").fill(GROUP === "admin" ? admin.email : ACC.demo().email);
    await p.getByLabel("Mật khẩu", { exact: true }).fill(GROUP === "admin" ? admin.password : ACC.demo().password);
    await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    state = await ctx.storageState(); await ctx.close();
  }
  const open = async (path, w, theme) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, storageState: state, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("nouri.theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && !/status of (4|5)\d\d|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(APP + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    return { ctx, page, errors };
  };
  const report = {};
  for (const [name, path] of PAGES[GROUP]) {
    const r = { path, overflow: {}, errors: [] };
    if (SHOTS === "1") {
      for (const w of [390, 768, 1440, 1920]) for (const theme of ["light", "dark"]) {
        const { ctx, page, errors } = await open(path, w, theme);
        await page.screenshot({ path: `${OUT}/${name}_${w}_${theme === "light" ? "sang" : "toi"}.png`, fullPage: true });
        r.overflow[`${w}`] = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        r.errors.push(...errors);
        await ctx.close();
      }
    }
    for (const theme of ["light", "dark"]) {
      const { ctx, page, errors } = await open(path, 1440, theme);
      r[theme] = await page.evaluate(`(${audit.toString().replace("ENGLISH_SRC", JSON.stringify(ENGLISH.source))})()`);
      r.errors.push(...errors);
      if (theme === "light") {
        const hiddenFocus = []; let stops = 0;
        for (let i = 0; i < 160; i++) {
          await page.keyboard.press("Tab"); await page.waitForTimeout(25);
          let info = await page.evaluate(() => {
            const el = document.activeElement; if (!el || el === document.body || el.closest("footer.site-footer")) return null;
            const cs = getComputedStyle(el.matches("input[type=file]") ? el.closest("label") || el : el);
            return { name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30), visible: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
          });
          if (!info) break;
          if (!info.visible) { await page.waitForTimeout(200); info.visible = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== "none" || s.boxShadow !== "none"; }); }
          stops++; if (!info.visible) hiddenFocus.push(info.name);
        }
        r.tab = { stops, hidden: hiddenFocus };
        const client = await ctx.newCDPSession(page);
        await client.send("DOM.enable"); await client.send("CSS.enable");
        const { root } = await client.send("DOM.getDocument", { depth: -1 });
        const fonts = new Set(); const wrong = [];
        for (const [selector, family] of [["h1", "Fraunces"], ["h2", "Fraunces"], ["h3", null], ["p", "Be Vietnam Pro"], ["button", "Be Vietnam Pro"], ["label", "Be Vietnam Pro"], ["td", "Be Vietnam Pro"], ["a", null]]) {
          const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
          for (const nodeId of nodeIds.slice(0, 6)) {
            const { fonts: used } = await client.send("CSS.getPlatformFontsForNode", { nodeId }).catch(() => ({ fonts: [] }));
            for (const f of used) { fonts.add(f.familyName); if (!f.isCustomFont || !/Fraunces|Be Vietnam Pro/.test(f.familyName)) wrong.push(`${selector}: ${f.familyName}`); }
          }
        }
        r.fonts = { used: [...fonts], wrong: [...new Set(wrong)] };
      }
      await ctx.close();
    }
    const narrow = await open(path, 320, "light");
    r.overflow["320"] = await narrow.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await narrow.ctx.close();
    report[name] = r;
    const l = r.light, d = r.dark;
    console.log(`${name}: tương phản ${l.contrastCount}/${d.contrastCount} lỗi, chữ<13px ${l.smallCount}, tiếng Anh [${l.english.join(",")}], · ${l.middot}, → ${l.arrow}, nghiêng ${l.italic.length}, in hoa ${l.upper.length}, nút chính trùng ${l.primaryDup.length}, Tab ${r.tab.stops} (ẩn ${r.tab.hidden.length}), phông sai ${r.fonts.wrong.length}, tràn ${JSON.stringify(r.overflow)}, lỗi console ${r.errors.length}`);
  }
  fs.writeFileSync(`audit-${GROUP}.json`, JSON.stringify(report, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
