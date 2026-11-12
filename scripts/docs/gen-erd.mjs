// Sinh docs/bao-cao/erd.md từ backend/prisma/schema.prisma: sơ đồ ERD (mermaid), bảng tóm tắt từng bảng (ý nghĩa, khóa, quan hệ),
// danh sách cột. Ý nghĩa lấy từ chú thích ngay trên model; model chưa có chú thích dùng MEANINGS (thiếu → script dừng báo lỗi).
//   node scripts/docs/gen-erd.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schema = readFileSync(join(root, "backend/prisma/schema.prisma"), "utf8").replace(/\r/g, "");

const MEANINGS = {
  User: "Tài khoản: email (duy nhất), mật khẩu băm bcrypt, vai trò USER/ADMIN, khóa tài khoản (lockedAt), tài khoản mẫu (isSample).",
  CommunityPost: "Bài viết cộng đồng: chữ, ảnh, gắn món có sẵn hoặc công thức tự viết (JSON); Admin ẩn; AI đánh dấu chờ duyệt.",
  CommunityLike: "Lượt thích bài viết; mỗi người thích một bài một lần.",
  CommunityComment: "Bình luận bài viết.",
  Notification: "Thông báo trong ứng dụng (kho sắp hết hạn/đã hết hạn/dưới mức tối thiểu, lượt thích, bình luận); dedupeKey chống trùng.",
  NutritionProfile: "Hồ sơ dinh dưỡng 1–1 với User: chỉ số cơ thể, mục tiêu, chế độ ăn, dị ứng, món không thích, chỉ tiêu tính sẵn, cài đặt nhắc hạn email.",
  PantryItem: "Thực phẩm trong kho của người dùng: số lượng, đơn vị, hạn, nơi bảo quản, mức tối thiểu, đơn giá (tùy chọn).",
  Recipe: "Công thức trong thư viện (seed 33 món, Admin thêm/sửa): dinh dưỡng một khẩu phần, nhãn chế độ ăn, bữa phù hợp; hiddenAt = ngừng dùng.",
  RecipeIngredient: "Nguyên liệu của công thức (tên, số lượng, đơn vị, tùy chọn).",
  MealPlan: "Thực đơn 7 ngày (OpenAI hoặc thuật toán chấm điểm), trạng thái DRAFT/ACTIVE/COMPLETED.",
  MealPlanDay: "Một ngày của thực đơn (duy nhất theo thực đơn + ngày).",
  MealPlanItem: "Một bữa: món, loại bữa, khẩu phần, calo đã lưu, đã ăn hay chưa.",
  ShoppingItem: "Dòng đi chợ của thực đơn; \"Đã mua\" → nhập kho.",
  ChatMessage: "Tin nhắn Hỏi Nouri (người dùng / trợ lý).",
};

// ---- Đọc schema: model (cột, chú thích), enum, quan hệ.
const lines = schema.split("\n");
const models = [];
const enums = [];
for (let index = 0; index < lines.length; index += 1) {
  const head = /^(model|enum) (\w+) \{/.exec(lines[index]);
  if (!head) continue;
  const comments = [];
  for (let back = index - 1; back >= 0 && /^\s*\/\//.test(lines[back]); back -= 1) comments.unshift(lines[back].replace(/^\s*\/{2,3}\s?/, ""));
  const body = [];
  let fieldComment = [];
  for (index += 1; lines[index] !== "}"; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("//")) { fieldComment.push(line.replace(/^\/{2,3}\s?/, "")); continue; }
    if (!line) { fieldComment = []; continue; }
    body.push({ line, comment: fieldComment.join(" ") });
    fieldComment = [];
  }
  if (head[1] === "enum") { enums.push({ name: head[2], values: body.map((entry) => entry.line) }); continue; }
  const fields = [];
  const attributes = [];
  for (const { line, comment } of body) {
    if (line.startsWith("@@")) { attributes.push(line); continue; }
    const match = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, name, type, list, optional, rest] = match;
    const relation = /@relation\((?:"[^"]*",\s*)?(?:name:\s*"[^"]*",\s*)?fields:\s*\[([^\]]+)\],\s*references:\s*\[([^\]]+)\](?:.*onDelete:\s*(\w+))?/.exec(rest);
    fields.push({
      name, type, list: Boolean(list), optional: Boolean(optional), id: rest.includes("@id"), unique: rest.includes("@unique"),
      relation: relation ? { fields: relation[1].split(",").map((part) => part.trim()), onDelete: relation[3] ?? "—" } : null,
      comment: comment || (/\/\/\s*(.*)$/.exec(rest)?.[1] ?? ""),
    });
  }
  models.push({ name: head[2], comments, fields, attributes });
}
const modelNames = new Set(models.map((model) => model.name));
const enumNames = new Set(enums.map((entry) => entry.name));

const missing = models.filter((model) => !model.comments.length && !MEANINGS[model.name]).map((model) => model.name);
if (missing.length) {
  console.error(`Thiếu mô tả bảng: ${missing.join(", ")}`);
  process.exit(1);
}

// ---- Quan hệ: cột có @relation(fields: [...]) là phía con (có khóa ngoại).
const relations = [];
for (const model of models) {
  for (const field of model.fields.filter((entry) => entry.relation)) {
    const fkFields = field.relation.fields.map((name) => model.fields.find((entry) => entry.name === name));
    const fkUnique = fkFields.length === 1 && fkFields[0]?.unique;
    const fkOptional = fkFields.some((entry) => entry?.optional);
    relations.push({ parent: field.type, child: model.name, label: field.name, fk: field.relation.fields.join(", "), onDelete: field.relation.onDelete, fkUnique, fkOptional });
  }
}

const mermaidType = (field) => (field.list ? `${field.type}_list` : field.type);
const keyOf = (model, field) => {
  const keys = [];
  if (field.id) keys.push("PK");
  if (model.fields.some((entry) => entry.relation?.fields.includes(field.name))) keys.push("FK");
  if (field.unique) keys.push("UK");
  return keys.join(",");
};
const scalar = (field) => !modelNames.has(field.type);

const diagram = [
  "```mermaid",
  "erDiagram",
  ...relations.map((relation) => {
    const parentSide = relation.fkOptional ? "|o" : "||";
    const childSide = relation.fkUnique ? "o|" : "o{";
    return `  ${relation.parent} ${parentSide}--${childSide} ${relation.child} : "${relation.label}"`;
  }),
  ...models.map((model) => [
    `  ${model.name} {`,
    ...model.fields.filter(scalar).map((field) => `    ${mermaidType(field)} ${field.name}${keyOf(model, field) ? ` ${keyOf(model, field)}` : ""}`),
    "  }",
  ].join("\n")),
  "```",
];

const escape = (text) => text.replaceAll("|", "\\|");
const meaningOf = (model) => (model.comments.length ? model.comments.join(" ") : MEANINGS[model.name]);
const summary = models.map((model) => {
  const pk = model.fields.filter((field) => field.id).map((field) => field.name);
  const uniques = [
    ...model.fields.filter((field) => field.unique).map((field) => field.name),
    ...model.attributes.filter((attr) => attr.startsWith("@@unique")).map((attr) => `(${/\[([^\]]+)\]/.exec(attr)[1]})`),
  ];
  const outgoing = relations.filter((relation) => relation.child === model.name)
    .map((relation) => `${relation.fk} → ${relation.parent} (xóa: ${relation.onDelete})`);
  const incoming = relations.filter((relation) => relation.parent === model.name).map((relation) => `${relation.child}.${relation.fk}`);
  return `| ${model.name} | ${escape(meaningOf(model))} | ${pk.join(", ")} | ${escape([...outgoing, ...(uniques.length ? [`duy nhất: ${uniques.join(", ")}`] : [])].join("; ") || "—")} | ${escape(incoming.join(", ") || "—")} |`;
});

const columns = models.map((model) => [
  `### ${model.name}`,
  "",
  meaningOf(model),
  "",
  "| Cột | Kiểu | Bắt buộc | Khóa | Ghi chú |",
  "|---|---|---|---|---|",
  ...model.fields.filter(scalar).map((field) => {
    const type = `${field.type}${field.list ? "[]" : ""}${enumNames.has(field.type) ? " (enum)" : ""}`;
    return `| ${field.name} | ${type} | ${field.optional || field.list ? "không" : "có"} | ${keyOf(model, field) || "—"} | ${escape(field.comment || "—")} |`;
  }),
  ...(model.attributes.length ? ["", `Chỉ mục / ràng buộc: ${model.attributes.map((attr) => `\`${attr}\``).join(", ")}.`] : []),
  "",
].join("\n"));

const output = [
  "# Sơ đồ dữ liệu (ERD)",
  "",
  `Sinh tự động từ \`backend/prisma/schema.prisma\` bằng \`node scripts/docs/gen-erd.mjs\` (${new Date().toISOString().slice(0, 10)}).`,
  `${models.length} bảng, ${enums.length} kiểu enum, ${relations.length} quan hệ khóa ngoại. CSDL: PostgreSQL qua Prisma; mọi thay đổi schema có migration`,
  "riêng trong `backend/prisma/migrations/`.",
  "",
  "Ký hiệu: `||--o{` một – nhiều, `||--o|` một – một (khóa ngoại duy nhất), `|o--o{` khóa ngoại có thể rỗng. Nhãn trên đường là tên quan hệ",
  "ở phía bảng con. Cột kiểu danh sách ghi `_list` trong sơ đồ (mermaid không nhận `[]`).",
  "",
  "## Sơ đồ",
  "",
  ...diagram,
  "",
  "## Tóm tắt các bảng",
  "",
  "| Bảng | Ý nghĩa | Khóa chính | Khóa ngoại (xóa khi cha bị xóa) / duy nhất | Được tham chiếu bởi |",
  "|---|---|---|---|---|",
  ...summary,
  "",
  "## Kiểu enum",
  "",
  "| Enum | Giá trị |",
  "|---|---|",
  ...enums.map((entry) => `| ${entry.name} | ${entry.values.join(", ")} |`),
  "",
  "## Cột của từng bảng",
  "",
  ...columns,
];
writeFileSync(join(root, "docs/bao-cao/erd.md"), output.join("\n"), "utf8");
console.log(`Đã ghi docs/bao-cao/erd.md: ${models.length} bảng, ${enums.length} enum, ${relations.length} quan hệ.`);
