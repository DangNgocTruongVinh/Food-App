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
// Script theo từng giai đoạn (GĐ3b, R2–R7, UI-1…UI-12): viết cho giao diện/dữ liệu lúc đó, nhiều nhãn và bố cục đã đổi
// (tách Admin, làm lại giao diện, tìm kiếm mới) nên LỖI THỜI — giữ làm bằng chứng nghiệm thu từng lượt, không bảo trì.
// Script còn dùng: demo-flow (luồng demo chính), landing-header-check, screenshots (ảnh cho quyển).
const LEGACY = /^(gd3b-|r\d|ui\d)/;
if (LEGACY.test(name)) console.warn(`Cảnh báo: "${name}" là script lỗi thời (giao diện cũ), có thể báo LỖI dù ứng dụng đúng. Dùng demo-flow.`);
const out = path.resolve(outDir ?? path.join(__dirname, "..", "output", name));
fs.mkdirSync(out, { recursive: true });
const result = spawnSync(process.execPath, [path.join(__dirname, `${name}.cjs`), out, ...rest], { stdio: "inherit" });
process.exit(result.status ?? 1);
