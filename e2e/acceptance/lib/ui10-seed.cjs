// Tạo bài thử "Thử UI10" của demo: 2 ảnh + công thức + 2 bình luận + 1 lượt thích của Admin. In id bài.
const ACC = require("./env.cjs");
const fs = require("fs");
const admin = require("./admin-env.cjs")();
const API = "http://localhost:4000/api";
const IMG = ACC.FIXTURES;
const login = async (body) => (await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()).token;
module.exports = async function seed() {
  const demo = await login({ email: ACC.demo().email, password: ACC.demo().password });
  const adm = await login(admin);
  const auth = (t) => ({ Authorization: `Bearer ${t}` });
  const recipes = await (await fetch(`${API}/recipes`, { headers: auth(demo) })).json();
  const recipe = (recipes.items || recipes).find((r) => r.name.startsWith("Cá kho tộ"));
  const form = new FormData();
  form.append("content", "Thử UI10: bữa tối nay nấu cá kho tộ, nước kho sánh, cá thấm vị. Mọi người góp ý giúp mình cách giữ cá không bị nát nhé.");
  form.append("recipeId", recipe.id);
  for (const f of ["thu-1.jpg", "thu-2.jpg"]) form.append("images", new Blob([fs.readFileSync(`${IMG}/${f}`)], { type: "image/jpeg" }), f);
  const res = await fetch(`${API}/community`, { method: "POST", headers: auth(demo), body: form });
  if (res.status !== 201) throw new Error("Đăng bài thử lỗi " + res.status + " " + (await res.text()));
  const post = await res.json();
  for (const content of ["Thử UI10: mình kho lửa nhỏ 40 phút, đảo nhẹ tay.", "Thử UI10: nên ướp cá với nước mắm trước 20 phút."]) {
    const r = await fetch(`${API}/community/${post.id}/comments`, { method: "POST", headers: { ...auth(demo), "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (!r.ok) throw new Error("Bình luận lỗi " + r.status);
  }
  await fetch(`${API}/community/${post.id}/like`, { method: "POST", headers: auth(adm) });
  return post.id;
};
if (require.main === module) module.exports().then((id) => console.log(id)).catch((e) => { console.error(e.message); process.exit(1); });
