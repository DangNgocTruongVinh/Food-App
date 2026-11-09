// Tài khoản Admin (ADMIN_EMAIL/ADMIN_PASSWORD) từ biến môi trường hoặc .env ở gốc repo — không in ra.
module.exports = () => require("./env.cjs").admin();
