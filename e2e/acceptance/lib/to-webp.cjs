// Đổi ảnh chụp PNG sang WebP (chất lượng 90, đủ in, giữ nguyên số điểm ảnh) và xóa PNG. WebP tối đa 16.383 px mỗi chiều:
// ảnh cao hơn được cắt thành nhiều phần liên tiếp (<tên>-1.webp, <tên>-2.webp…), không thu nhỏ.
// Dùng sharp của backend (đã cài sẵn). CLI: node to-webp.cjs <thư mục> → đổi mọi PNG trong thư mục và sửa liên kết trong README.md.
const fs = require("fs");
const path = require("path");
const sharp = require(require.resolve("sharp", { paths: [path.resolve(__dirname, "../../../backend")] }));

const MAX = 16383;
const OPTIONS = { quality: 90, effort: 6, smartSubsample: true };

/** Trả về tên các tệp WebP đã tạo (theo thứ tự). */
async function toWebp(pngPath) {
  const { width, height } = await sharp(pngPath).metadata();
  const base = pngPath.replace(/\.png$/i, "");
  const parts = Math.ceil(height / MAX);
  const outputs = [];
  for (let index = 0; index < parts; index += 1) {
    const top = Math.round((height * index) / parts);
    const bottom = Math.round((height * (index + 1)) / parts);
    const out = parts === 1 ? `${base}.webp` : `${base}-${index + 1}.webp`;
    await sharp(pngPath).extract({ left: 0, top, width, height: bottom - top }).webp(OPTIONS).toFile(out);
    outputs.push(path.basename(out));
  }
  fs.unlinkSync(pngPath);
  return outputs;
}

module.exports = { toWebp };

if (require.main === module) {
  (async () => {
    const dir = path.resolve(process.argv[2] ?? ".");
    const readme = path.join(dir, "README.md");
    let text = fs.existsSync(readme) ? fs.readFileSync(readme, "utf8") : "";
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".png")).sort()) {
      const outputs = await toWebp(path.join(dir, file));
      text = text.replace(`[${file}](${file})`, outputs.map((name) => `[${name}](${name})`).join(", "));
      console.log(file, "→", outputs.join(", "));
    }
    if (text) fs.writeFileSync(readme, text);
  })().catch((error) => { console.error(error.message); process.exit(1); });
}
