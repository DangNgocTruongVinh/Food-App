// Chạy một script nghiệm thu: npm run e2e:acceptance -- <tên> [thư mục ảnh] [tham số khác của script…]
// Không có thư mục ảnh thì dùng e2e/output/<tên>/ (không đưa vào git). Danh sách script: README.md (mục Nghiệm thu Playwright).
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const [name, outDir, ...rest] = process.argv.slice(2);
const scripts = fs.readdirSync(__dirname).filter((file) => file.endsWith(".cjs") && file !== "run.cjs").map((file) => file.replace(/\.cjs$/, ""));
if (!name || !scripts.includes(name)) {
  console.error(`Dùng: npm run e2e:acceptance -- <tên> [thư mục ảnh]\nCó: ${scripts.sort().join(", ")}`);
  process.exit(1);
}
const out = path.resolve(outDir ?? path.join(__dirname, "..", "output", name));
fs.mkdirSync(out, { recursive: true });
const result = spawnSync(process.execPath, [path.join(__dirname, `${name}.cjs`), out, ...rest], { stdio: "inherit" });
process.exit(result.status ?? 1);
