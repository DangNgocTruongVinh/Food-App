import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedRecipes } from "../prisma/seed-data.js";

// Tải ảnh thật cho các món lên Cloudinary bằng đúng luồng của Admin: kiểm định dạng theo byte đầu (jpg/png/webp), ≤ 5 MB, xóa EXIF
// bằng sharp (stripImageMetadata), rồi replaceRecipeImage (tải lên nouri/recipes, lưu DB, ghi nhật ký Admin RECIPE_IMAGE_REPLACE
// dưới tên Admin đầu tiên, xóa ảnh cũ sau khi lưu). Không thêm logic xử lý ảnh mới.
//
//   npm run upload:recipe-photos -w backend -- --dry-run          (kiểm thư mục ảnh, không tải, không ghi DB)
//   npm run upload:recipe-photos -w backend                        (tải thật; cần DATABASE_URL, JWT_SECRET, CLOUDINARY_*)
//   npm run upload:recipe-photos -w backend -- --list              (ghi docs/anh-mon-can-tim.md: slug + tên 33 món, không cần DB)
//   Thư mục ảnh: biến PHOTOS_DIR hoặc --dir <thư mục>. Trong đó: <slug>.jpg|.jpeg|.png|.webp và nguon.txt, mỗi dòng "slug|nguồn ảnh".
//   Món không có dòng nguồn thì bị bỏ qua (ảnh lấy từ bên ngoài phải ghi nguồn). Chạy thật xong ghi docs/bao-cao/nguon-anh-mon.md.

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function writeList() {
  const rows = seedRecipes.map((recipe, index) => `| ${index + 1} | \`${recipe.slug}\` | ${recipe.name} |`);
  const content = [
    "# Ảnh món cần tìm",
    "",
    `Sinh từ \`backend/prisma/seed-data.ts\` bằng \`npm run upload:recipe-photos -w backend -- --list\` (${seedRecipes.length} món).`,
    "Đặt ảnh tên `<slug>.jpg` (hoặc .png, .webp, ≤ 5 MB) vào một thư mục, kèm `nguon.txt` mỗi dòng `slug|nguồn ảnh` (đường dẫn, tác giả,",
    "giấy phép), rồi chạy `npm run upload:recipe-photos -w backend -- --dir <thư mục> --dry-run` để kiểm, bỏ `--dry-run` để tải thật.",
    "Chạy trên máy (thư mục ảnh ở máy): đặt `DATABASE_URL` tới Postgres của Docker (`localhost:5432`), `JWT_SECRET`, `CLOUDINARY_*` như",
    "`backend/.env.example`. Ảnh được xóa EXIF và tải bằng đúng luồng \"Thay ảnh\" của Admin (ghi nhật ký Admin, xóa ảnh cũ sau khi lưu).",
    "",
    "| # | Slug (tên file) | Tên món |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(join(root, "docs/anh-mon-can-tim.md"), content, "utf8");
  console.log(`Đã ghi docs/anh-mon-can-tim.md: ${seedRecipes.length} món.`);
}

/** nguon.txt: "slug|nguồn"; dòng trống và dòng bắt đầu bằng # bị bỏ qua. */
export function readSources(text: string) {
  const sources = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [slug, ...rest] = trimmed.split("|");
    const source = rest.join("|").trim();
    if (slug.trim() && source) sources.set(slug.trim(), source);
  }
  return sources;
}

async function main() {
  if (args.includes("--list")) return writeList();
  const dir = resolve(option("--dir") ?? process.env.PHOTOS_DIR ?? "");
  if (!option("--dir") && !process.env.PHOTOS_DIR) throw new Error("Thiếu thư mục ảnh: đặt PHOTOS_DIR hoặc --dir <thư mục>.");
  if (!existsSync(dir)) throw new Error(`Không có thư mục ${dir}`);
  // Nạp sau khi kiểm tham số: các module dưới đọc env.ts (cần DATABASE_URL, JWT_SECRET).
  const { prisma } = await import("../src/lib/prisma.js");
  const { detectImageFormat, MAX_IMAGE_BYTES } = await import("../src/services/image-file.js");
  const { stripImageMetadata } = await import("../src/services/image-sanitize.js");
  const { isImageUploadConfigured } = await import("../src/services/image-upload.service.js");
  const { replaceRecipeImage } = await import("../src/modules/recipes/recipe-management.service.js");

  const sourceFile = join(dir, "nguon.txt");
  const sources = existsSync(sourceFile) ? readSources(readFileSync(sourceFile, "utf8")) : new Map<string, string>();
  const files = readdirSync(dir).filter((file) => EXTENSIONS.includes(extname(file).toLowerCase()));
  const recipes = await prisma.recipe.findMany({ select: { id: true, slug: true, name: true } });
  const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]));
  if (!dryRun && !isImageUploadConfigured()) throw new Error("Chưa cấu hình CLOUDINARY_* nên không tải ảnh được (dùng --dry-run để chỉ kiểm).");
  const admin = dryRun ? null : await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true } });
  if (!dryRun && !admin) throw new Error("Không có tài khoản Admin để ghi nhật ký (chạy seed với ADMIN_EMAIL, ADMIN_PASSWORD).");

  const done: Array<{ slug: string; name: string; source: string }> = [];
  let skipped = 0;
  for (const file of files.sort()) {
    const slug = file.slice(0, -extname(file).length);
    const recipe = bySlug.get(slug);
    const reason = !recipe ? "không có món với slug này"
      : !sources.has(slug) ? "thiếu dòng nguồn trong nguon.txt"
        : statSync(join(dir, file)).size > MAX_IMAGE_BYTES ? "ảnh lớn hơn 5 MB"
          : null;
    const buffer = reason ? null : readFileSync(join(dir, file));
    const format = buffer ? detectImageFormat(buffer) : null;
    const problem = reason ?? (format ? null : "không phải JPG/PNG/WEBP (kiểm byte đầu)");
    if (problem) {
      console.warn(`Bỏ qua ${file}: ${problem}.`);
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`[thử] ${file} → ${recipe!.name}`);
    } else {
      const clean = await stripImageMetadata(buffer!, format!);
      const updated = await replaceRecipeImage(admin!.id, recipe!.id, clean);
      console.log(`Đã tải ${file} → ${recipe!.name}: ${updated.imageUrl}`);
    }
    done.push({ slug, name: recipe!.name, source: sources.get(slug)! });
  }
  const missing = recipes.filter((recipe) => !files.some((file) => file.startsWith(`${recipe.slug}.`))).map((recipe) => recipe.slug);
  console.log(`${dryRun ? "Kiểm xong" : "Xong"}: ${done.length} ảnh ${dryRun ? "hợp lệ" : "đã tải"}, ${skipped} bỏ qua; món chưa có ảnh trong thư mục: ${missing.length}.`);
  if (!dryRun && done.length) {
    const credits = [
      "# Nguồn ảnh món",
      "",
      `Ghi bởi \`npm run upload:recipe-photos\` (${new Date().toISOString().slice(0, 10)}), lấy từ \`nguon.txt\` của thư mục ảnh. Ảnh đã xóa EXIF, lưu trên Cloudinary (nouri/recipes).`,
      "",
      "| Slug | Tên món | Nguồn |",
      "|---|---|---|",
      ...done.map((entry) => `| \`${entry.slug}\` | ${entry.name} | ${entry.source.replaceAll("|", "\\|")} |`),
      "",
    ].join("\n");
    writeFileSync(join(root, "docs/bao-cao/nguon-anh-mon.md"), credits, "utf8");
    console.log("Đã ghi docs/bao-cao/nguon-anh-mon.md.");
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
