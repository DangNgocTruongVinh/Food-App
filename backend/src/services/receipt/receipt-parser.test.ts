import { describe, expect, it } from "vitest";
import { numberCandidates, parseItemLine, parseReceiptDate, parseReceiptLines, skipReasonOf } from "./receipt-parser.js";

// Dòng hóa đơn mẫu tự soạn theo các kiểu in thường gặp: có dấu, không dấu viết hoa, viết tắt, một dòng/hai dòng.

const item = (text: string) => parseItemLine(text);
const names = (lines: string[]) => parseReceiptLines(lines).items.map((entry) => entry.name);

describe("numberCandidates", () => {
  it("hiểu dấu chấm/phẩy theo kiểu Việt Nam và giữ cả hai cách hiểu khi mơ hồ", () => {
    expect(numberCandidates("15000")).toEqual([15000]);
    expect(numberCandidates("15.000")).toEqual([15, 15000]);
    expect(numberCandidates("15,000đ")).toEqual([15, 15000]);
    expect(numberCandidates("0,512")).toEqual([0.512]);
    expect(numberCandidates("1,5")).toEqual([1.5]);
    expect(numberCandidates("1.234.567")).toEqual([1234567]);
    expect(numberCandidates("1.234,5")).toEqual([1234.5]);
    expect(numberCandidates("12.34.5")).toEqual([]);
  });
});

describe("parseItemLine — một dòng", () => {
  it("tên + SL + đơn vị + đơn giá + thành tiền (có dấu)", () => {
    expect(item("Thịt heo xay 0,5 kg 130.000 65.000")).toMatchObject({
      name: "Thịt heo xay", quantity: 0.5, unit: "KG", unitPrice: 130000, price: 65000, consistent: true,
    });
  });

  it("không dấu, viết hoa, SL không đơn vị", () => {
    expect(item("TRUNG GA 10 3.200 32.000")).toMatchObject({ name: "TRUNG GA", quantity: 10, unit: null, unitPrice: 3200, price: 32000, consistent: true });
  });

  it("đơn vị đếm sau số lượng: bó, hộp, quả", () => {
    expect(item("Rau muống 1 bó 8.000")).toMatchObject({ name: "Rau muống", quantity: 1, unit: "ITEM", price: 8000 });
    expect(item("Sữa chua 2 hộp 14.000")).toMatchObject({ name: "Sữa chua", quantity: 2, unit: "PACKAGE", price: 14000 });
    expect(item("Chanh 5 quả 10.000")).toMatchObject({ quantity: 5, unit: "ITEM" });
  });

  it("dấu nhân: SL x đơn giá (tự tính thành tiền)", () => {
    expect(item("Bánh mì 2 x 15.000")).toMatchObject({ name: "Bánh mì", quantity: 2, unitPrice: 15000, price: 30000 });
    expect(item("BANH MI 2x15.000")).toMatchObject({ quantity: 2, unitPrice: 15000, price: 30000 });
  });

  it("hàng cân: số lượng lẻ chọn đúng nhờ SL × đơn giá = thành tiền", () => {
    expect(item("CA HOI 0.512 x 129.000 66.048")).toMatchObject({ quantity: 0.512, unitPrice: 129000, price: 66048, consistent: true });
    expect(item("Thịt bò 1.25KG 100.000 125.000")).toMatchObject({ name: "Thịt bò", quantity: 1.25, unit: "KG", price: 125000 });
    expect(item("Cà chua 1 KG x 25,000 = 25,000")).toMatchObject({ name: "Cà chua", quantity: 1, unit: "KG", price: 25000, consistent: true });
  });

  it("chỉ có đơn giá và thành tiền: SL = thành tiền / đơn giá", () => {
    expect(item("Dưa leo 12.000 36.000")).toMatchObject({ quantity: 3, unitPrice: 12000, price: 36000, consistent: true });
  });

  it("chỉ có thành tiền: chưa biết số lượng", () => {
    expect(item("Nấm hương 45.000đ")).toMatchObject({ name: "Nấm hương", quantity: null, price: 45000 });
  });

  it("dung tích/khối lượng trong tên × số hộp → tổng lượng, tên bỏ quy cách", () => {
    expect(item("Sữa tươi 180ml 4 8.500 34.000")).toMatchObject({ name: "Sữa tươi", quantity: 720, unit: "ML", price: 34000 });
    expect(item("Bột mì 1kg 2 gói 40.000")).toMatchObject({ name: "Bột mì", quantity: 2, unit: "KG" });
    expect(item("Rau muống VietGAP 500g 12.000")).toMatchObject({ name: "Rau muống VietGAP", quantity: 500, unit: "G", price: 12000 });
  });

  it("bỏ số thứ tự đầu dòng và mã vạch; sửa chữ O/l đọc nhầm trong số", () => {
    expect(item("1. Cải thìa 1 bó 10.000")).toMatchObject({ name: "Cải thìa", quantity: 1, unit: "ITEM" });
    expect(item("8934563123457 Mì gói 5 4.000 20.000")).toMatchObject({ name: "Mì gói", quantity: 5, price: 20000 });
    expect(item("Hành lá 1 bó 1O.000")).toMatchObject({ price: 10000 });
  });

  it("chữ bò trong tên không bị hiểu là đơn vị bó", () => {
    expect(item("Thịt bò 0,3 kg 300.000 90.000")).toMatchObject({ name: "Thịt bò", quantity: 0.3, unit: "KG" });
  });

  it("số trong tên vẫn giữ (Mì 3 Miền)", () => {
    expect(item("Mì 3 Miền 30 gói 105.000")).toMatchObject({ name: "Mì 3 Miền", quantity: 30, unit: "PACKAGE" });
  });

  it("tên không đủ chữ → null", () => {
    expect(item("12 34.000")).toBeNull();
  });
});

describe("skipReasonOf", () => {
  it.each([
    ["Tổng cộng: 245.000", "TOTAL"], ["TONG TIEN HANG 245,000", "TOTAL"], ["Tạm tính 200.000", "TOTAL"], ["Thành tiền 245.000", "TOTAL"],
    ["VAT 8%: 18.000", "TAX"], ["Thuế GTGT", "TAX"],
    ["Giảm giá -5.000", "DISCOUNT"], ["KM 1 TANG 1", "DISCOUNT"], ["Chiết khấu thành viên 10.000", "DISCOUNT"],
    ["Tiền khách đưa 500.000", "PAYMENT"], ["TIEN THOI LAI 255.000", "PAYMENT"], ["Thẻ VISA **** 1234", "PAYMENT"],
    ["Chuyển khoản 245.000", "PAYMENT"],
    ["Túi nilon 1 500", "BAG"], ["TUI GIAY", "BAG"], ["Phí giao hàng 15.000", "FEE"],
    ["Điểm tích lũy: 245", "POINTS"],
    ["MST: 0301234567", "HEADER"], ["Địa chỉ: 12 Lê Lợi, Q1", "HEADER"], ["Hotline 1900 1234", "HEADER"],
    ["Thu ngân: Nguyễn Văn A", "HEADER"], ["Ngày 09/11/2026 10:35", "HEADER"], ["09/11/2026 10:35", "HEADER"],
    ["Tên hàng SL Đơn giá Thành tiền", "HEADER"], ["Cảm ơn quý khách!", "HEADER"], ["Số HĐ: 000123", "HEADER"],
  ])("%s → %s", (text, reason) => {
    expect(skipReasonOf(text)).toBe(reason);
  });

  it.each(["Giấm gạo 1 chai 12.000", "Giò lụa 0,5 kg 90.000", "Cá thu 1 kg 180.000", "Phi lê cá basa 1 khay 65.000", "Túi lọc trà 1 hộp 30.000", "Quẩy 2 cái 10.000"])(
    "không bỏ nhầm dòng hàng: %s", (text) => {
      expect(skipReasonOf(text)).toBeNull();
    },
  );
});

describe("parseReceiptDate", () => {
  it("các kiểu ngày trên nhãn", () => {
    expect(parseReceiptDate("HSD: 20/12/26")).toBe("2026-12-20");
    expect(parseReceiptDate("EXP 2026-12-20")).toBe("2026-12-20");
    expect(parseReceiptDate("HSD 20.12.2026")).toBe("2026-12-20");
    expect(parseReceiptDate("HSD: 02/2027")).toBe("2027-02-28");
    expect(parseReceiptDate("HSD 31/02/2026")).toBeNull();
  });
});

describe("parseReceiptLines", () => {
  it("hóa đơn có dấu đầy đủ: bỏ đầu/cuối, tổng tiền, VAT, túi, thanh toán", () => {
    const result = parseReceiptLines([
      "SIÊU THỊ ABC", "Địa chỉ: 12 Lê Lợi, Q1", "HÓA ĐƠN BÁN LẺ", "Ngày: 09/11/2026 10:35", "--------------------",
      "Tên hàng SL Đơn giá Thành tiền",
      "Thịt heo xay 0,5 kg 130.000 65.000", "Trứng gà 10 3.200 32.000", "Rau muống 1 bó 8.000", "Túi nilon 1 500",
      "--------------------", "Tổng cộng 105.500", "VAT 8% 7.800", "Tiền khách đưa 200.000", "Tiền thối 94.500", "Cảm ơn quý khách!",
    ]);
    expect(result.items.map((entry) => entry.name)).toEqual(["Thịt heo xay", "Trứng gà", "Rau muống"]);
    expect(result.skipped.map((entry) => entry.reason)).toEqual(
      expect.arrayContaining(["HEADER", "BAG", "TOTAL", "TAX", "PAYMENT"]),
    );
    expect(result.skipped.find((entry) => entry.rawText === "SIÊU THỊ ABC")?.reason).toBe("HEADER");
  });

  it("hóa đơn không dấu hai dòng: tên ở dòng trên, SL x đơn giá ở dòng dưới", () => {
    const result = parseReceiptLines([
      "BACH HOA ABC", "THIT HEO XAY", "0.512 x 129.000 66.048", "SUA TUOI 180ML", "SL: 4 DG: 8.500 TT: 34.000",
      "CA CHUA", "1 KG x 25,000 = 25,000", "TONG CONG 125.048",
    ]);
    expect(result.items).toMatchObject([
      { name: "THIT HEO XAY", quantity: 0.512, price: 66048, consistent: true },
      { name: "SUA TUOI", quantity: 720, unit: "ML", price: 34000 },
      { name: "CA CHUA", quantity: 1, unit: "KG", price: 25000 },
    ]);
  });

  it("dòng số âm là khuyến mãi; dòng chỉ có số không thuộc dòng nào thì bỏ", () => {
    const result = parseReceiptLines(["Dưa leo 1 kg 20.000", "Giảm giá -2.000", "-2.000", "123.456", "Tổng 18.000"]);
    expect(result.items.map((entry) => entry.name)).toEqual(["Dưa leo"]);
    expect(result.skipped.map((entry) => entry.reason)).toEqual(["DISCOUNT", "DISCOUNT", "NOISE", "TOTAL"]);
  });

  it("viết tắt và dòng thiếu giá giữa các dòng hàng vẫn giữ (để người dùng sửa)", () => {
    expect(names(["Cá basa 1 khay 65.000", "DAU HU NON", "Hành lá 1 bó 5.000"])).toEqual(["Cá basa", "DAU HU NON", "Hành lá"]);
  });

  it("nhãn sản phẩm: một sản phẩm, khối lượng tịnh và HSD", () => {
    const result = parseReceiptLines([
      "SỮA TƯƠI TIỆT TRÙNG", "Thành phần: sữa bò tươi, đường", "Khối lượng tịnh: 1 lít", "NSX: 01/11/2026", "HSD: 01/05/2027",
    ]);
    expect(result.items).toMatchObject([{ name: "SỮA TƯƠI TIỆT TRÙNG", quantity: 1, unit: "L", expiryDate: "2027-05-01" }]);
    expect(result.skipped.every((entry) => entry.reason === "LABEL_INFO")).toBe(true);
  });

  it("dòng chỉ có ký tự phân cách bị bỏ hẳn, giữ độ tin cậy thấp nhất khi ghép hai dòng", () => {
    const result = parseReceiptLines([{ text: "=====", confidence: 90 }, { text: "XA LACH", confidence: 88 }, { text: "1 x 15.000", confidence: 52 }]);
    expect(result.items).toMatchObject([{ name: "XA LACH", quantity: 1, price: 15000, confidence: 52 }]);
    expect(result.skipped).toEqual([]);
  });
});
