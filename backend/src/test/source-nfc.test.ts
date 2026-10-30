import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Chữ tiếng Việt trong mã nguồn phải ở dạng Unicode NFC (dấu ghép sẵn). Dạng dấu rời (NFD) hiển thị lệch dấu
// với nhiều phông chữ và làm so khớp tên nguyên liệu/dị ứng sai.
const backendRoot = fileURLToPath(new URL("../..", import.meta.url));
const roots = ["src", "prisma"].map((dir) => join(backendRoot, dir));
const extensions = new Set([".ts", ".js", ".json", ".prisma", ".sql"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "dist" ? [] : sourceFiles(path);
    return extensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe("backend source text encoding", () => {
  it("keeps every source file (including seed data and migrations) in Unicode NFC", () => {
    const files = roots.flatMap(sourceFiles);
    expect(files.length).toBeGreaterThan(10);
    const notNfc = files
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return text !== text.normalize("NFC");
      })
      .map((file) => relative(backendRoot, file));
    expect(notNfc).toEqual([]);
  });
});
