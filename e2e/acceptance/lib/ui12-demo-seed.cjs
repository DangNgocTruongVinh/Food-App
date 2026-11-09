// Dữ liệu tạm cho bộ ảnh cuối (tài khoản demo): 1 thực đơn đang áp dụng (2 bữa đã ăn, 3 món đã mua), 1 bài viết gắn công thức
// + 1 bình luận của Admin, 1 câu hỏi trợ lý. Ghi id vào demo-seed.json để dọn (xóa thực đơn, xóa bài; tin nhắn xóa theo thời điểm).
const ACC = require("./env.cjs");
const fs = require("fs");
const { execFileSync } = require("child_process");
const admin = require("./admin-env.cjs")();
const API = "http://localhost:4000/api";
const sql = (q) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { cwd: ACC.ROOT, input: q }).toString().trim();
const login = async (body) => (await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()).token;
const call = (token) => async (method, path, body) => {
  const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status >= 400) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(json)}`);
  return json;
};
(async () => {
  const seedStart = sql("SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"');");
  const demo = call(await login({ email: ACC.demo().email, password: ACC.demo().password }));
  const adm = call(await login(admin));
  const d = new Date();
  const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const plan = await demo("POST", "/meal-plans/generate", { startDate });
  await demo("PATCH", `/meal-plans/${plan.id}/status`, { status: "ACTIVE" });
  const full = await demo("GET", `/meal-plans/${plan.id}`);
  const todayItems = full.days[0].items.sort((a, b) => ["BREAKFAST", "LUNCH", "SNACK", "DINNER"].indexOf(a.mealType) - ["BREAKFAST", "LUNCH", "SNACK", "DINNER"].indexOf(b.mealType));
  for (const item of todayItems.slice(0, 2)) await demo("PATCH", `/meal-plans/items/${item.id}`, { completed: true });
  for (const item of full.shoppingItems.slice(0, 3)) await demo("PATCH", `/meal-plans/shopping/${item.id}`, { purchased: true });
  const recipes = await demo("GET", "/recipes");
  const recipe = recipes.find((r) => r.name.startsWith("Canh chua chay"));
  const post = await demo("POST", "/community", { content: "Canh chua chay nấu với thơm và đậu bắp trong tủ, chua thanh, ăn với cơm nóng rất hợp ngày nóng.", recipeId: recipe.id });
  await adm("POST", `/community/${post.id}/comments`, { content: "Thêm chút rau ngổ lúc tắt bếp sẽ thơm hơn." });
  await adm("POST", `/community/${post.id}/like`);
  await demo("POST", "/ai/chat", { message: "Tối nay mình nên nấu món gì từ đồ sắp hết hạn trong kho?" });
  fs.writeFileSync("demo-seed.json", JSON.stringify({ seedStart, planId: plan.id, postId: post.id }));
  console.log("ok", plan.id, post.id);
})().catch((e) => { console.error(e.message); process.exit(1); });
