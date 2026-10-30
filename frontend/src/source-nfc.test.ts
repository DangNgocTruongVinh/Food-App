import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Chữ tiếng Việt trong mã nguồn phải ở dạng Unicode NFC (dấu ghép sẵn); dạng dấu rời (NFD) hiển thị lệch dấu.
const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
const extensions = new Set([".ts", ".tsx", ".css", ".html", ".json"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return extensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe("frontend source text encoding", () => {
  it("keeps every source file and index.html in Unicode NFC", () => {
    const files = [...sourceFiles(join(frontendRoot, "src")), join(frontendRoot, "index.html")];
    expect(files.length).toBeGreaterThan(10);
    const notNfc = files
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return text !== text.normalize("NFC");
      })
      .map((file) => relative(frontendRoot, file));
    expect(notNfc).toEqual([]);
  });
});
