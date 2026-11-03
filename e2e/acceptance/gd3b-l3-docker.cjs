// GĐ3b lượt 3: "Đã ăn" → trừ kho, bỏ "đã ăn" → hoàn lại. Kiểm bằng API trên Docker (nginx :8080) với demo. Dọn dữ liệu thử.
const ACC = require("./lib/env.cjs");
const { execFileSync } = require("child_process");
const APP = "http://localhost:8080/api";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
const sql = (q) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { cwd: ACC.ROOT, input: q }).toString().trim();
const fmt = (n) => Math.round(n * 1000) / 1000;

(async () => {
  const start = sql("SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"');");
  const token = (await (await fetch(`${APP}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json()).token;
  const call = async (method, path, body) => {
    const res = await fetch(APP + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
  const pantry = async () => (await call("GET", "/pantry")).body;
  const snapshot = await pantry();
  console.log("Kho demo lúc đầu:", snapshot.map((i) => `${i.name} ${i.quantity} ${i.unit}`).join(", "));
  const otherToken = (await (await fetch(`${APP}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(require("./lib/admin-env.cjs")()) })).json()).token;

  // 1) Tạo thực đơn hôm nay, tìm bữa có nguyên liệu trong kho.
  const d = new Date();
  const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const plan = (await call("POST", "/meal-plans/generate", { startDate })).body;
  check("Tạo thực đơn 7 ngày", plan.days?.length === 7);
  let meal = null, preview = null;
  for (const item of plan.days.flatMap((day) => day.items)) {
    const p = (await call("GET", `/meal-plans/items/${item.id}/consumption-preview`)).body;
    if (p.lines.some((line) => line.deductions.length && line.defaultQuantity > 0)) { meal = item; preview = p; break; }
  }
  check("Có bữa dùng nguyên liệu trong kho demo", Boolean(meal), meal && preview.recipe.name);
  console.log("Xem trước:", preview.lines.map((l) => `${l.name}: ${l.status} (cần ${l.required.quantity} ${l.required.unit}${l.deductions.length ? `; trừ ${l.deductions.map((x) => `${x.quantity} ${x.unit} từ ${x.name}`).join(", ")}` : ""})`).join(" | "));
  check("Xem trước có trạng thái cho mọi nguyên liệu, không đổi kho", preview.lines.length > 0 && preview.lines.every((l) => ["ENOUGH", "SHORT", "NOT_IN_PANTRY", "UNIT_MISMATCH", "EXPIRED_ONLY", "OPTIONAL"].includes(l.status))
    && JSON.stringify((await pantry()).map((i) => i.quantity)) === JSON.stringify(snapshot.map((i) => i.quantity)));
  check("Tài khoản khác xem trước bữa của demo → 404", (await fetch(`${APP}/meal-plans/items/${meal.id}/consumption-preview`, { headers: { Authorization: `Bearer ${otherToken}` } })).status === 404);

  // 2) Trừ theo lượng mặc định.
  const lines = preview.lines.filter((l) => l.defaultQuantity > 0).map((l) => ({ ingredientId: l.ingredientId, quantity: l.defaultQuantity, unit: l.required.unit }));
  const expected = new Map();
  for (const l of preview.lines.filter((x) => x.defaultQuantity > 0)) for (const x of l.deductions) expected.set(x.pantryItemId, fmt((expected.get(x.pantryItemId) ?? 0) + x.quantity));
  const deducted = await call("PATCH", `/meal-plans/items/${meal.id}`, { completed: true, consumption: { mode: "deduct", lines } });
  check("PATCH deduct → 200, đã ăn, có tóm tắt đã trừ", deducted.status === 200 && deducted.body.completed === true && deducted.body.consumption.lines.length === lines.length);
  const after = await pantry();
  const okDeduct = snapshot.every((i) => fmt(i.quantity - (expected.get(i.id) ?? 0)) === fmt(after.find((a) => a.id === i.id).quantity));
  check("Kho giảm đúng lượng đã trừ, không âm", okDeduct && after.every((i) => i.quantity >= 0), [...expected].map(([id, q]) => `${snapshot.find((i) => i.id === id).name} −${q}`).join(", "));
  let history = (await call("GET", "/pantry/transactions?source=CONSUMPTION&pageSize=50")).body.items.filter((t) => t.mealPlanItem?.id === meal.id);
  check("Lịch sử: mỗi lần trừ một dòng CONSUMPTION gắn bữa ăn", history.length === expected.size && history.every((t) => t.delta < 0 && t.reversalOfId === null), `${history.length} dòng`);

  // 3) Gửi lại → không trừ hai lần.
  const again = await call("PATCH", `/meal-plans/items/${meal.id}`, { completed: true, consumption: { mode: "deduct", lines } });
  check("Gửi lại deduct → alreadyCompleted, kho không đổi", again.body.alreadyCompleted === true && JSON.stringify((await pantry()).map((i) => i.quantity)) === JSON.stringify(after.map((i) => i.quantity)));

  // 4) Sửa tay một thực phẩm đã bị trừ (+100 cùng đơn vị) rồi bỏ "đã ăn" → cộng lại phần đã trừ vào số hiện tại.
  const editedId = [...expected.keys()][0];
  const editedBefore = after.find((i) => i.id === editedId);
  await call("PUT", `/pantry/${editedId}`, { quantity: fmt(editedBefore.quantity + 100) });
  const undo = await call("PATCH", `/meal-plans/items/${meal.id}`, { completed: false });
  const restoredPantry = await pantry();
  const okRestore = snapshot.every((i) => fmt(restoredPantry.find((a) => a.id === i.id).quantity) === fmt(i.quantity + (i.id === editedId ? 100 : 0)));
  check("Bỏ \"đã ăn\" → hoàn lại đúng lượng (kể cả thực phẩm vừa sửa tay: số hiện tại + phần đã trừ)", undo.status === 200 && undo.body.completed === false && okRestore
    && undo.body.restoration.restored.length === expected.size && undo.body.restoration.skipped.length === 0);
  history = (await call("GET", "/pantry/transactions?source=CONSUMPTION&pageSize=50")).body.items.filter((t) => t.mealPlanItem?.id === meal.id);
  const originals = history.filter((t) => !t.reversalOfId), reversals = history.filter((t) => t.reversalOfId);
  check("Lịch sử: dòng hoàn lại trỏ về dòng gốc, dòng gốc có reversedAt", reversals.length === originals.length && originals.every((o) => o.reversedAt && reversals.some((r) => r.reversalOfId === o.id && r.delta > 0)));
  const undo2 = await call("PATCH", `/meal-plans/items/${meal.id}`, { completed: false });
  check("Bỏ \"đã ăn\" lần nữa → không hoàn lại hai lần", undo2.body.restoration.restored.length === 0
    && JSON.stringify((await pantry()).map((i) => i.quantity)) === JSON.stringify(restoredPantry.map((i) => i.quantity)));

  // 5) Chỉ đánh dấu, không trừ kho.
  const markOnly = await call("PATCH", `/meal-plans/items/${meal.id}`, { completed: true, consumption: { mode: "none" } });
  check("\"Chỉ đánh dấu, không trừ kho\" → kho không đổi", markOnly.body.completed === true && markOnly.body.consumption === null
    && JSON.stringify((await pantry()).map((i) => i.quantity)) === JSON.stringify(restoredPantry.map((i) => i.quantity)));

  // 6) Danh sách đi chợ vẫn là phần còn thiếu (món seed 1 khẩu phần, bữa 1 khẩu phần).
  check("Danh sách đi chợ có số dương", plan.shoppingItems.length > 0 && plan.shoppingItems.every((s) => s.quantity > 0), `${plan.shoppingItems.length} dòng`);

  // Dọn: trả số lượng thực phẩm đã sửa tay, xóa thực đơn thử, lịch sử và thông báo tạo trong lượt thử.
  await call("PUT", `/pantry/${editedId}`, { quantity: editedBefore.quantity + (expected.get(editedId) ?? 0) });
  await call("DELETE", `/meal-plans/${plan.id}`);
  const demoId = `(SELECT id FROM "User" WHERE email='${ACC.demo().email}')`;
  sql(`DELETE FROM "PantryTransaction" WHERE "userId"=${demoId} AND "createdAt" >= '${start}';`);
  sql(`DELETE FROM "Notification" WHERE "userId"=${demoId} AND "createdAt" >= '${start}';`);
  const final = await pantry();
  check("Dọn: kho demo đúng như đầu (tên, số lượng, đơn vị, hạn), 0 thực đơn, 0 lịch sử, không thông báo mới",
    JSON.stringify(final.map(({ id, name, quantity, unit, expiryDate }) => [id, name, quantity, unit, expiryDate])) === JSON.stringify(snapshot.map(({ id, name, quantity, unit, expiryDate }) => [id, name, quantity, unit, expiryDate]))
    && (await call("GET", "/meal-plans")).body.length === 0 && sql(`SELECT count(*) FROM "PantryTransaction";`) === "0"
    && sql(`SELECT count(*) FROM "Notification" WHERE "userId"=${demoId} AND "createdAt" >= '${start}';`) === "0");
  console.log(`\nTổng: ${results.filter(Boolean).length}/${results.length} đạt`);
})().catch((e) => { console.error(e); process.exit(1); });
