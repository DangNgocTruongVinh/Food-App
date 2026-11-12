import { describe, expect, it } from "vitest";
import { readSources } from "./recipe-photo-sources.js";

describe("readSources (nguon.txt của upload:recipe-photos)", () => {
  it("đọc slug|nguồn, bỏ khoảng trắng hai đầu, hỗ trợ xuống dòng Windows", () => {
    const sources = readSources(" pho-bo | https://example.com/pho.jpg (CC BY 4.0) \r\nca-kho-to|Ảnh tự chụp\r\n");
    expect([...sources]).toEqual([["pho-bo", "https://example.com/pho.jpg (CC BY 4.0)"], ["ca-kho-to", "Ảnh tự chụp"]]);
  });

  it("bỏ dòng trống, dòng chú thích #, dòng thiếu slug hoặc thiếu nguồn", () => {
    const sources = readSources("\n# chú thích|x\n|chỉ có nguồn\nchi-co-slug|\nchi-co-slug-khong-gach\nbun-cha|Nguồn A\n");
    expect([...sources]).toEqual([["bun-cha", "Nguồn A"]]);
  });

  it("nguồn được chứa '|' (chỉ tách ở dấu đầu tiên); slug trùng thì dòng sau thắng", () => {
    const sources = readSources("pho-bo|Tác giả | Giấy phép CC0\npho-bo|Nguồn mới\ngoi-cuon|A | B | C");
    expect(sources.get("pho-bo")).toBe("Nguồn mới");
    expect(sources.get("goi-cuon")).toBe("A | B | C");
  });
});
