const ACC = require("./lib/env.cjs");
const API = "http://localhost:4000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "ĐẠT " : "LỖI "} ${name}${detail ? " — " + detail : ""}`); };
(async () => {
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json();
  const call = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${login.token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const recipes = (await call("GET", "/recipes")).body;
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const bySlug = new Map(recipes.map((r) => [r.slug, r]));
  const pantry = (await call("GET", "/pantry")).body;
  const tofu = pantry.find((p) => p.name === "Đậu hũ");
  const original = (await call("GET", "/profile")).body.profile;
  const contexts = [
    ["today", "?context=today&limit=5"],
    ["for-you", "?context=for-you&limit=5"],
    ["pantry", "?context=pantry&limit=5"],
    ["pantry + Đậu hũ", `?context=pantry&pantryItemId=${tofu.id}&limit=5`],
    ["similar (Bún xào chay)", `?context=similar&recipeId=${bySlug.get("bun-xao-chay").id}&limit=4`],
    ["also-cooked (Bún xào chay)", `?context=also-cooked&recipeId=${bySlug.get("bun-xao-chay").id}&limit=4`],
    ["also-cooked (Gà xào sả ớt)", `?context=also-cooked&recipeId=${bySlug.get("ga-xao-sa-ot").id}&limit=4`],
  ];
  const seafood = (r) => r.ingredients.some((i) => /^(cá|tôm|nước mắm)( |$)/.test(i.name.toLocaleLowerCase("vi")));
  const run = async (label) => {
    const all = [];
    for (const [name, query] of contexts) {
      const res = await call("GET", `/recommendations${query}`);
      const items = res.body.items ?? [];
      console.log(`\n[${label}] ${name}: ${res.status}, coldStart=${res.body.coldStart}`);
      for (const it of items) console.log(`   ${it.recipe.name.padEnd(28)} ${it.score.toFixed(2)}  ${it.reason}`);
      check(`${label} ${name}: 200, mỗi món có lý do`, res.status === 200 && items.every((it) => it.reason && it.reason.length > 5), `${items.length} món`);
      if (name.startsWith("pantry + ")) check(`${label} ${name}: mọi món dùng Đậu hũ`, items.every((it) => byId.get(it.recipe.id).ingredients.some((i) => i.name === "Đậu hũ")));
      all.push(...items.map((it) => byId.get(it.recipe.id)));
    }
    const dash = (await call("GET", "/dashboard")).body.recommendedRecipes;
    console.log(`\n[${label}] Tổng quan: ${dash.map((d) => `${d.name} (${d.reason})`).join("; ")}`);
    check(`${label} Tổng quan: 3 món, có reason`, dash.length === 3 && dash.every((d) => d.reason));
    all.push(...dash.map((d) => byId.get(d.id)));
    return all;
  };
  await run("Hồ sơ gốc");
  check("Đầu kiểm: hồ sơ demo chưa dị ứng hải sản", !(original.allergies ?? []).includes("Hải sản"));
  const put = await call("PUT", "/profile", { allergies: [...(original.allergies ?? []), "Hải sản"] });
  check("Đặt dị ứng Hải sản cho demo", put.status === 200, String(put.status));
  const withAllergy = await run("Dị ứng Hải sản");
  const bad = withAllergy.filter(seafood).map((r) => r.name);
  check("Dị ứng Hải sản: không món nào có cá, tôm, nước mắm (mọi ngữ cảnh + Tổng quan)", bad.length === 0, bad.join(", "));
  const restore = await call("PUT", "/profile", { allergies: original.allergies ?? [] });
  const after = (await call("GET", "/profile")).body.profile;
  const same = ["dietType", "allergies", "dislikedFoods", "preferredCuisines", "mealsPerDay", "dailyCalorieTarget", "goal", "age", "weightKg", "heightCm"]
    .every((k) => JSON.stringify(after[k]) === JSON.stringify(original[k]));
  check("Trả hồ sơ demo về ban đầu", restore.status === 200 && same);
  const bad422 = await call("GET", "/recommendations?context=similar");
  check("Thiếu recipeId → 422", bad422.status === 422);
  console.log(`\n${results.filter(Boolean).length}/${results.length} đạt`);
})();
