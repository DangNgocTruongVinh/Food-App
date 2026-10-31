import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Quy tắc kiểm được của docs/design/DESIGN.md (mục 3, 4, 15) cho phần giao diện mới.
// Khi một trang được làm lại, thêm thư mục CSS/component của trang đó vào danh sách bên dưới.
const srcRoot = fileURLToPath(new URL("../..", import.meta.url));
const NEW_CSS_DIRS = ["styles/ui"];
const NEW_COMPONENT_DIRS = ["components/ui", "components/dev-ui", "components/layout", "components/notifications", "pages/dev", "pages/admin", "pages/info", "layouts"];

function filesIn(dir: string, extensions: string[]): string[] {
  return readdirSync(join(srcRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(path, extensions);
    return extensions.includes(extname(entry.name)) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(join(srcRoot, path), "utf8");
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
/** Bỏ comment trong TS/TSX (chỉ xét chữ hiển thị và mã). */
const withoutTsComments = (code: string) => withoutComments(code).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("new UI CSS uses tokens only", () => {
  const cssFiles = NEW_CSS_DIRS.flatMap((dir) => filesIn(dir, [".css"]));

  it("has no hard-coded color outside tokens.css", () => {
    const offenders = cssFiles
      .filter((file) => !file.endsWith("tokens.css"))
      .flatMap((file) => [...withoutComments(read(file)).matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|color-mix)\(/gi)]
        .map((match) => `${relative(".", file)}: ${match[0]}`));
    expect(cssFiles.length).toBeGreaterThan(1);
    expect(offenders).toEqual([]);
  });

  it("uses no decorative gradient, frosted glass or bouncing hover", () => {
    const offenders = cssFiles.filter((file) => /gradient\(|backdrop-filter|:hover[^{]*\{[^}]*(?:scale|translate)/i.test(withoutComments(read(file))));
    expect(offenders).toEqual([]);
  });
});

describe("new UI components (checklist mục 3.1)", () => {
  const sources = NEW_COMPONENT_DIRS.flatMap((dir) => filesIn(dir, [".ts", ".tsx"])).map((file) => [file, withoutTsComments(read(file))] as const);

  // ©, ®, ™ thuộc Extended_Pictographic nhưng là ký hiệu văn bản (vd. "© 2026 Nouri"), không phải emoji.
  it("contain no emoji or sparkle icons", () => {
    const offenders = sources.filter(([, text]) => /(?![©®™])\p{Extended_Pictographic}|Sparkle/u.test(text)).map(([file]) => file);
    expect(sources.length).toBeGreaterThan(5);
    expect(offenders).toEqual([]);
  });

  it("do not glue an arrow onto button or link text", () => {
    expect(sources.filter(([, text]) => text.includes("→")).map(([file]) => file)).toEqual([]);
  });
});
