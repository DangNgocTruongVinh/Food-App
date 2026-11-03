const ACC = require("./lib/env.cjs");
const API = "http://localhost:4000/api";
(async () => {
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ACC.demo().email, password: ACC.demo().password }) })).json();
  const get = async (p) => (await fetch(API + p, { headers: { Authorization: `Bearer ${login.token}` } })).json();
  let ok = true;
  for (const context of ["for-you", "today"]) {
    const res = await get(`/recommendations?context=${context}&limit=6`);
    console.log(`\n${context}: coldStart=${res.coldStart}`);
    for (const it of res.items) console.log(`  ${it.recipe.name.padEnd(30)} S=${it.score.toFixed(2)} [nd ${it.components.content.toFixed(2)} | ct ${it.components.collaborative.toFixed(2)} | tt ${it.components.knowledge.toFixed(2)}] ${it.reason}`);
    const kinds = new Set(res.items.map((it) => it.reason.split(":")[0].replace(/\d+/g, "N")));
    const fromCF = res.items.filter((it) => it.components.collaborative > 0);
    const cfReason = res.items.filter((it) => it.reason.startsWith("Người hay nấu"));
    console.log(`  → ${kinds.size} loại lý do; ${fromCF.length} món có đóng góp thuật toán 2; ${cfReason.length} món lấy lý do từ thuật toán 2`);
    ok = ok && !res.coldStart && kinds.size >= 2 && fromCF.length > 0;
  }
  const dash = (await get("/dashboard")).recommendedRecipes;
  console.log(`\nTổng quan: ${dash.map((d) => `${d.name} — ${d.reason}`).join(" | ")}`);
  console.log(ok ? "\nĐẠT" : "\nLỖI");
})();
