// GĐ3b lượt 2: kiểm trên Docker (:8080) — thêm/sửa/xóa thực phẩm qua giao diện đều sinh đúng dòng lịch sử. Dọn dữ liệu thử.
const ACC = require("./lib/env.cjs");
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const APP = "http://localhost:8080";
const NAME = "Thử GĐ3b Đậu hũ non";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const sql = (q) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { cwd: ACC.ROOT, input: q }).toString().trim();

(async () => {
  const start = sql("SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"');");
  const before = sql(`SELECT count(*) FROM "PantryItem" WHERE "userId"=(SELECT id FROM "User" WHERE email='${ACC.demo().email}');`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(APP + "/login");
  await p.getByLabel("Email").fill(ACC.demo().email);
  await p.getByLabel("Mật khẩu", { exact: true }).fill(ACC.demo().password);
  await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await p.waitForURL("**/dashboard");
  const token = await p.evaluate(() => localStorage.getItem("nouri_token") || sessionStorage.getItem("nouri_token"));
  const history = async (query = "") => (await (await fetch(`${APP}/api/pantry/transactions?pageSize=50${query}`, { headers: { Authorization: `Bearer ${token}` } })).json());
  const mine = async () => (await history()).items.filter((t) => t.itemName === NAME);

  await p.goto(APP + "/pantry");
  const save = async (label) => { await p.locator("dialog[open]").getByRole("button", { name: label }).click(); await p.locator("dialog[open]").waitFor({ state: "detached" }).catch(() => {}); await p.waitForTimeout(600); };
  // 1) Thêm 500 g.
  await p.locator("main").getByRole("button", { name: "Thêm thực phẩm" }).first().click();
  await p.locator("dialog[open]").getByLabel("Tên thực phẩm").fill(NAME);
  await p.locator("dialog[open]").getByLabel("Số lượng").fill("500");
  await p.locator("dialog[open]").getByLabel("Đơn vị").selectOption("G");
  await save("Lưu vào kho");
  let rows = await mine();
  check("Thêm 500 g → 1 dòng \"Nhập tay\" +500, còn 500 g", rows.length === 1 && rows[0].source === "MANUAL_ADD" && rows[0].delta === 500 && rows[0].quantityAfter === 500 && rows[0].unit === "G");
  const itemId = rows[0].pantryItemId;

  // 2) Sửa số lượng 500 → 320.
  await p.getByRole("button", { name: `Sửa ${NAME}` }).first().click();
  await p.locator("dialog[open]").getByLabel("Số lượng").fill("320");
  await save("Lưu thay đổi");
  rows = await mine();
  check("Sửa số lượng 500 → 320 → thêm dòng \"Sửa tay\" −180", rows.length === 2 && rows[0].source === "MANUAL_EDIT" && rows[0].delta === -180 && rows[0].quantityAfter === 320);

  // 3) Chỉ sửa ghi chú (form gửi đủ trường) → không có dòng mới.
  await p.getByRole("button", { name: `Sửa ${NAME}` }).first().click();
  await p.locator("dialog[open]").getByLabel("Ghi chú").fill("Để ngăn mát, dùng trong tuần");
  await save("Lưu thay đổi");
  rows = await mine();
  check("Chỉ sửa ghi chú → không sinh lịch sử", rows.length === 2);

  // 4) Đổi đơn vị g → kg (0,32 kg) → delta 0, ghi chú đổi đơn vị.
  await p.getByRole("button", { name: `Sửa ${NAME}` }).first().click();
  await p.locator("dialog[open]").getByLabel("Số lượng").fill("0.32");
  await p.locator("dialog[open]").getByLabel("Đơn vị").selectOption("KG");
  await save("Lưu thay đổi");
  rows = await mine();
  check("Đổi 320 g → 0,32 kg → dòng \"Sửa tay\" delta 0, ghi chú đổi đơn vị", rows.length === 3 && rows[0].delta === 0 && rows[0].unit === "KG" && rows[0].note === "Đổi đơn vị: 320 g → 0,32 kg", rows[0].note);

  // 5) Xóa (hộp xác nhận) → dòng "Xóa tay" −0,32 kg, lịch sử còn sau khi xóa (pantryItemId về null).
  await p.getByRole("button", { name: `Xóa ${NAME}` }).first().click();
  await p.locator("dialog[open]").getByRole("button", { name: "Xóa thực phẩm" }).click();
  await p.locator(".ui-toast", { hasText: "Đã xóa" }).waitFor();
  rows = await mine();
  check("Xóa → dòng \"Xóa tay\" −0,32 kg, còn 0; lịch sử giữ tên sau khi xóa (pantryItemId null)", rows.length === 4 && rows[0].source === "MANUAL_DELETE"
    && rows[0].delta === -0.32 && rows[0].quantityAfter === 0 && rows.every((r) => r.pantryItemId === null));
  check("Thứ tự mới nhất trước: xóa, đổi đơn vị, sửa, thêm", JSON.stringify(rows.map((r) => r.source)) === JSON.stringify(["MANUAL_DELETE", "MANUAL_EDIT", "MANUAL_EDIT", "MANUAL_ADD"]));
  const filtered = await history("&source=MANUAL_EDIT");
  check("Lọc theo nguồn \"Sửa tay\"", filtered.items.filter((t) => t.itemName === NAME).length === 2 && filtered.items.every((t) => t.source === "MANUAL_EDIT"));
  const adminToken = (await (await fetch(`${APP}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(require("./lib/admin-env.cjs")()) })).json()).token;
  const other = await (await fetch(`${APP}/api/pantry/transactions?pageSize=50`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  check("Tài khoản khác không thấy lịch sử của demo", !other.items.some((t) => t.itemName === NAME));
  const rowsDb = sql(`SELECT count(*) FROM "PantryTransaction" WHERE "createdAt" >= '${start}';`);
  check("DB: đúng 4 dòng lịch sử mới trong lượt thử", rowsDb === "4", rowsDb);
  check("Không lỗi trang", errors.length === 0, errors.join(" | "));
  await b.close();

  // Dọn: chỉ các dòng lịch sử của thực phẩm thử, tạo trong lượt thử này.
  sql(`DELETE FROM "PantryTransaction" WHERE "itemName"='${NAME}' AND "createdAt" >= '${start}';`);
  const after = sql(`SELECT count(*) FROM "PantryItem" WHERE "userId"=(SELECT id FROM "User" WHERE email='${ACC.demo().email}');`);
  check("Dọn: không còn thực phẩm thử và lịch sử thử; kho demo giữ nguyên số thực phẩm", after === before && sql(`SELECT count(*) FROM "PantryTransaction";`) === "0"
    && sql(`SELECT count(*) FROM "PantryItem" WHERE name='${NAME}';`) === "0", `${before} → ${after}`);
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt (item ${itemId})`);
})().catch((e) => { console.error(e); process.exit(1); });
