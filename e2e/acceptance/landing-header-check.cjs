// Đo header trang chủ khi đã đăng nhập, 1024–1279px (và 1280, 390 để đối chiếu): tên dài phải cắt "…" gọn, trang không tràn ngang.
// Không chụp ảnh. Tạm đổi tên demo thành tên rất dài qua API rồi trả lại tên cũ (demo:reset cũng đặt lại tên).
// node landing-header-check.cjs <thư mục> (thư mục không dùng). Cần Docker đang chạy (app: 8080, API: 4000).
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const APP = process.env.APP_URL || "http://localhost:8080";
const API = "http://localhost:4000/api";
const LONG_NAME = "Nguyễn Thị Phương Thảo Hoàng Ngọc Minh Châu Trần Lê";
const WIDTHS = [1024, 1080, 1152, 1200, 1240, 1279, 1280, 390];

const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };

(async () => {
  const login = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ACC.demo(), remember: true }),
  });
  const session = await login.json();
  if (!login.ok) throw new Error(`Đăng nhập demo lỗi ${login.status}`);
  const auth = { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" };
  const oldName = session.user.name;
  const rename = (name) => fetch(`${API}/profile`, { method: "PUT", headers: auth, body: JSON.stringify({ name }) });
  if (!(await rename(LONG_NAME)).ok) throw new Error("Không đổi được tên demo");
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce" });
      await ctx.addInitScript(([token, user]) => {
        localStorage.setItem("nouri_token", token);
        localStorage.setItem("nouri_user", JSON.stringify(user));
        localStorage.setItem("nouri_remember_login", "1");
      }, [session.token, { ...session.user, name: LONG_NAME }]);
      const page = await ctx.newPage();
      await page.goto(APP + "/");
      if (width < 1024) await page.getByRole("button", { name: "Mở menu trang chủ" }).click();
      const greeting = page.locator(width < 1024 ? ".ld-mobile-nav .ld-header__greeting" : ".ld-header__account .ld-header__greeting");
      await greeting.waitFor();
      const m = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        const header = document.querySelector(".ld-header__inner").getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const buttons = [...el.parentElement.querySelectorAll(".ld-btn")].map((b) => b.getBoundingClientRect());
        return {
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
          truncated: el.scrollWidth > el.clientWidth, ellipsis: getComputedStyle(el).textOverflow === "ellipsis",
          insideHeader: box.right <= header.right + 0.5 && box.left >= 0,
          overlap: buttons.some((b) => b.left < box.right - 0.5 && b.right > box.left && b.top < box.bottom && b.bottom > box.top),
          oneLine: box.height < 40, title: el.title, width: Math.round(box.width),
          // Cụm tài khoản (cột phải) không lấn sang menu neo ở giữa (chỉ ≥ 1024px mới có menu neo).
          navGap: document.querySelector(".ld-nav")?.offsetParent
            ? Math.round(document.querySelector(".ld-header__actions").getBoundingClientRect().left - document.querySelector(".ld-nav").getBoundingClientRect().right)
            : null,
        };
      }, width < 1024 ? ".ld-mobile-nav .ld-header__greeting" : ".ld-header__account .ld-header__greeting");
      check(`${width}px không tràn ngang`, m.pageOverflow <= 0, `scrollWidth - innerWidth = ${m.pageOverflow}`);
      check(`${width}px lời chào gọn một dòng, không đè nút`, m.oneLine && m.insideHeader && !m.overlap, `rộng ${m.width}px`);
      if (m.navGap !== null) check(`${width}px không đè menu neo`, m.navGap >= 0, `khoảng cách ${m.navGap}px`);
      check(`${width}px tên dài cắt "…" (đủ tên ở title)`, m.truncated ? m.ellipsis && m.title === LONG_NAME : true, m.truncated ? "đã cắt" : "vừa, không cần cắt");
      await ctx.close();
    }
  } finally {
    await browser.close();
    await rename(oldName);
  }
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `${failed} mục LỖI` : `Tất cả ${results.length} mục ĐẠT`);
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error.message); process.exit(1); });
