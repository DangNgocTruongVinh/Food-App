import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Combobox } from "../../components/ui/Combobox";
import { comboKey, foldChars, highlightParts, rankOptions, type ComboOption } from "./combobox.logic";

const option = (label: string, keywords: string[] = [], detail?: string): ComboOption => ({ id: label, label, keywords, detail });
const options = [
  option("Bánh mì ốp la", ["Trứng", "Bánh mì"]),
  option("Cơm trộn Hàn Quốc", ["Gạo", "Trứng"], "ẩn theo hồ sơ"),
  option("Canh chua cá lóc", ["Cá lóc", "Me"]),
  option("Trứng chiên rau củ", ["Trứng", "Cà rốt"]),
  option("Đậu hũ sốt cà chua", ["Đậu hũ"]),
];
const labels = (query: string, list = options) => rankOptions(list, query).map((item) => item.label);

describe("Combobox: lọc và xếp hạng gợi ý", () => {
  it("gõ ≥ 1 ký tự, không dấu, không phân biệt hoa thường; khớp đầu tên lên trước", () => {
    expect(labels("")).toEqual([]);
    expect(labels("c")).toEqual(["Cơm trộn Hàn Quốc", "Canh chua cá lóc", "Trứng chiên rau củ", "Đậu hũ sốt cà chua"]);
    expect(labels("COM TRON")).toEqual(["Cơm trộn Hàn Quốc"]);
    expect(labels("dau hu")).toEqual(["Đậu hũ sốt cà chua"]);
  });

  it("nhiều từ theo thứ tự bất kỳ, tìm cả chữ ẩn (nguyên liệu), sai nhẹ 1 ký tự", () => {
    expect(labels("han tron")).toEqual(["Cơm trộn Hàn Quốc"]);
    expect(labels("trung")).toEqual(["Trứng chiên rau củ", "Bánh mì ốp la", "Cơm trộn Hàn Quốc"]); // khớp tên trước, rồi nguyên liệu
    expect(labels("trứnh")).toEqual(["Trứng chiên rau củ", "Bánh mì ốp la", "Cơm trộn Hàn Quốc"]);
    expect(labels("xyz")).toEqual([]);
  });

  it("tối đa 8 mục, bỏ trùng tên", () => {
    const many = Array.from({ length: 20 }, (_, index) => option(`Món ${index}`));
    expect(rankOptions(many, "mon")).toHaveLength(8);
    expect(labels("trứng", [option("Trứng"), { ...option("trứng"), id: "x" }])).toEqual(["Trứng"]);
  });

  it("in đậm phần khớp trên chữ có dấu", () => {
    expect(foldChars("Đậu Hũ")).toBe("dau hu");
    expect(highlightParts("Cơm trộn Hàn Quốc", "tron com")).toEqual([
      { text: "Cơm", match: true }, { text: " ", match: false }, { text: "trộn", match: true }, { text: " Hàn Quốc", match: false },
    ]);
  });
});

describe("Combobox: bàn phím", () => {
  const closed = { open: false, active: -1 };
  it("↓↑ chọn vòng, Enter chọn mục đang chọn", () => {
    const down = comboKey(closed, "ArrowDown", 3);
    expect(down.state).toEqual({ open: true, active: 0 });
    expect(comboKey({ open: true, active: 2 }, "ArrowDown", 3).state.active).toBe(0);
    expect(comboKey({ open: true, active: 0 }, "ArrowUp", 3).state.active).toBe(2);
    expect(comboKey({ open: true, active: 1 }, "Enter", 3).command).toBe("select");
  });

  it("Enter khi không chọn gợi ý → giữ hành vi cũ của ô (enter); Esc chỉ đóng khi đang mở", () => {
    expect(comboKey({ open: true, active: -1 }, "Enter", 3)).toEqual({ state: closed, command: "enter" });
    expect(comboKey(closed, "Enter", 0).command).toBe("enter");
    expect(comboKey({ open: true, active: 1 }, "Escape", 3)).toEqual({ state: closed, command: "close" });
    expect(comboKey(closed, "Escape", 3).command).toBeNull(); // Esc lần hai để hộp thoại tự đóng
    expect(comboKey({ open: true, active: 1 }, "Tab", 3).state).toEqual(closed);
  });
});

describe("Combobox: chuẩn truy cập", () => {
  it("ô nhập là combobox trỏ tới listbox, đóng thì aria-expanded=false và danh sách ẩn", () => {
    const html = renderToStaticMarkup(createElement(Combobox, {
      id: "tim-mon", value: "", onValueChange: () => undefined, options, onPick: () => undefined, placeholder: "Tìm món",
    }));
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-controls="tim-mon-list"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toMatch(/<ul id="tim-mon-list" role="listbox"[^>]*hidden/);
  });
});
