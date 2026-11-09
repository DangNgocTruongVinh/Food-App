const ACC = require("./lib/env.cjs");
const env = require("./lib/admin-env.cjs")();
const { execFileSync } = require("child_process");
const API = "http://localhost:4000/api";
const sql = (q) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { cwd: ACC.ROOT, input: q }).toString().trim();
(async () => {
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: env.email, password: env.password }) })).json();
  const get = async (p) => (await fetch(API + p, { headers: { Authorization: `Bearer ${login.token}` } })).json();
  const stats = await get("/admin/stats");
  const db = sql(`SELECT (SELECT count(*) FROM "User" WHERE NOT "isSample"), (SELECT count(*) FROM "User" WHERE "isSample"),
    (SELECT count(*) FROM "MealPlan" m JOIN "User" u ON u.id=m."userId" WHERE NOT u."isSample"), (SELECT count(*) FROM "CommunityPost" p JOIN "User" u ON u.id=p."authorId" WHERE NOT u."isSample");`);
  const [realUsers, sampleUsers, realPlans, realPosts] = db.split("|").map(Number);
  console.log("Thống kê Admin không đếm tài khoản mẫu:", stats.totals.users === realUsers && stats.totals.mealPlans === realPlans && stats.totals.posts === realPosts ? "ĐẠT" : "LỖI",
    JSON.stringify({ api: stats.totals, realUsers, sampleUsers, realPlans, realPosts }));
  const weekUsers = stats.weekly.reduce((s, w) => s + w.users, 0);
  console.log("Thống kê theo tuần không đếm tài khoản mẫu:", weekUsers <= realUsers ? "ĐẠT" : "LỖI", `users 12 tuần = ${weekUsers}`);
  const users = await get("/admin/users?pageSize=50");
  const samples = users.items.filter((u) => u.isSample);
  console.log("Danh sách Admin có cờ isSample:", samples.length === 8 && samples.every((u) => /^mau\d@nouri\.vn$/.test(u.email) && u.name.startsWith("Người dùng mẫu")) ? "ĐẠT" : "LỖI", samples.length);
  const inter = sql(`SELECT u.email, (SELECT count(*) FROM "MealPlanItem" i JOIN "MealPlanDay" d ON d.id=i."dayId" JOIN "MealPlan" m ON m.id=d."mealPlanId" WHERE m."userId"=u.id AND i.completed),
    (SELECT count(*) FROM "CommunityPost" p WHERE p."authorId"=u.id AND p."recipeId" IS NOT NULL), (SELECT count(*) FROM "CommunityLike" l WHERE l."userId"=u.id) FROM "User" u WHERE u."isSample" ORDER BY u.email;`);
  console.log("Tương tác của tài khoản mẫu (email|đã ăn|bài gắn món|lượt thích):\n" + inter);
  // Đăng nhập tài khoản mẫu với mật khẩu đoán được phải thất bại.
  const guess = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `mau1@${ACC.demo().email.split("@")[1]}`, password: ACC.demo().password }) });
  console.log("Không đăng nhập được tài khoản mẫu bằng mật khẩu đoán:", guess.status === 401 ? "ĐẠT" : "LỖI", guess.status);
})();
