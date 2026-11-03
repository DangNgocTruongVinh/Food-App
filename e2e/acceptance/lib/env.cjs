// Cấu hình chung cho script nghiệm thu: gốc repo, ảnh mẫu, tài khoản đọc từ biến môi trường (hoặc file .env ở gốc repo).
// Không có giá trị mặc định cho email/mật khẩu; không in mật khẩu ra màn hình.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURES = path.join(__dirname, "..", "fixtures");

function readDotEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, "")]; }));
}
const dotEnv = readDotEnv();
const get = (key) => process.env[key] || dotEnv[key];

function account(prefix) {
  const email = get(`${prefix}_EMAIL`);
  const password = get(`${prefix}_PASSWORD`);
  if (!email || !password) throw new Error(`Thiếu ${prefix}_EMAIL/${prefix}_PASSWORD (biến môi trường hoặc .env ở gốc repo).`);
  return { email, password };
}

module.exports = {
  ROOT,
  FIXTURES,
  demo: () => account("DEMO"),
  admin: () => account("ADMIN"),
  /** Mật khẩu cho tài khoản thử tạo trong lượt (ngẫu nhiên mỗi lần chạy, đủ quy tắc mật khẩu). */
  testPassword: `Thu-${crypto.randomBytes(6).toString("hex")}Aa1`,
};
