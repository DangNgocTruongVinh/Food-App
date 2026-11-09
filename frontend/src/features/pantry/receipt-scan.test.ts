import { describe, expect, it } from "vitest";
import type { ReceiptDraftLine } from "../../types";
import {
  commitMessage, isExpiryEstimated, providerNotice, receiptFileError, restoreSkippedLine, reviewErrors, scaledSize, scanStageText, scanStepOf,
  targetText, toCommitLines, toEditableLines, undoMessage, uploadErrorMessage,
} from "./receipt-scan.logic";

const draft = (overrides: Partial<ReceiptDraftLine> = {}): ReceiptDraftLine => ({
  key: "l1", rawText: "THIT HEO XAY 0,5 kg 130.000 65.000", name: "Thịt heo xay", quantity: 0.5, unit: "KG", category: "Thịt & cá",
  storageLocation: "REFRIGERATOR", expiryDate: "2026-11-11", expiryEstimated: true, price: 65000, target: { kind: "create" },
  warnings: [], flags: [], ...overrides,
});

describe("receipt-scan.logic", () => {
  it("kiểm file ảnh: định dạng và 5 MB", () => {
    expect(receiptFileError({ size: 100, type: "image/jpeg" })).toBeNull();
    expect(receiptFileError({ size: 100, type: "image/heic" })).toContain("JPG, PNG hoặc WEBP");
    expect(receiptFileError({ size: 6 * 1024 * 1024, type: "image/png" })).toContain("5 MB");
  });

  it("thu nhỏ giữ tỉ lệ, không phóng to", () => {
    expect(scaledSize(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("bước tiến trình theo phase của API, kèm phần trăm", () => {
    expect(scanStepOf("uploading")).toBe("upload");
    expect(scanStepOf("queued")).toBe("read");
    expect(scanStepOf("parsing")).toBe("parse");
    expect(scanStageText("uploading", 0.456)).toBe("Đang tải ảnh lên 46 %");
    expect(scanStageText("reading", 1)).toBe("Đang đọc chữ trên ảnh 100 %");
    expect(scanStageText("queued", null)).toBe("Đang chờ đọc ảnh");
  });

  it("ghi rõ chế độ đọc dự phòng", () => {
    expect(providerNotice("tesseract")).toBe("Đọc bằng chế độ dự phòng, vui lòng kiểm tra kỹ từng dòng trước khi lưu.");
  });

  it("hạn ước tính chỉ còn khi chưa sửa ngày", () => {
    const [line] = toEditableLines([draft()]);
    expect(isExpiryEstimated(line)).toBe(true);
    expect(isExpiryEstimated({ ...line, expiryDate: "2026-11-15" })).toBe(false);
    expect(isExpiryEstimated({ ...line, expiryDate: "" })).toBe(false);
  });

  it("đích trong kho: cộng vào món có sẵn, tạo mới; sửa tên/đơn vị thì báo ghép lại khi lưu", () => {
    const [merge] = toEditableLines([draft({ target: { kind: "merge", pantryItemId: "p1", name: "Thịt heo xay", quantity: 200, unit: "G" } })]);
    expect(targetText(merge)).toBe("Cộng vào “Thịt heo xay” đang có 200 g");
    expect(targetText(toEditableLines([draft()])[0])).toBe("Tạo thực phẩm mới trong kho");
    expect(targetText({ ...merge, unit: "G" })).toContain("Khi lưu");
    expect(targetText({ ...merge, name: "  thịt HEO xay " })).toContain("Cộng vào");
  });

  it("khôi phục dòng bị bỏ: tên bỏ phần số cuối dòng", () => {
    expect(restoreSkippedLine("Túi lọc trà 1 30.000", 2)).toMatchObject({ key: "skipped-2", name: "Túi lọc trà", quantity: 1, unit: "ITEM", restored: true });
  });

  it("lỗi chỉ tính dòng đang chọn; gửi đi chỉ dòng đang chọn, hạn trống = null", () => {
    const lines = toEditableLines([draft(), draft({ key: "l2", name: "" }), draft({ key: "l3", name: "Rau muống", expiryDate: null })]);
    expect(reviewErrors(lines, new Set(["l1"]))).toEqual({
      l1: { expiryDate: "Nhập ngày theo dạng dd/mm/yyyy hoặc để trống." }, l2: { name: "Nhập tên thực phẩm." },
    });
    const chosen = lines.map((line) => (line.key === "l2" ? { ...line, include: false } : line));
    expect(reviewErrors(chosen, new Set())).toEqual({});
    expect(toCommitLines(chosen)).toEqual([
      { name: "Thịt heo xay", quantity: 0.5, unit: "KG", category: "Thịt & cá", storageLocation: "REFRIGERATOR", expiryDate: "2026-11-11", expiryEstimated: true },
      { name: "Rau muống", quantity: 0.5, unit: "KG", category: "Thịt & cá", storageLocation: "REFRIGERATOR", expiryDate: null, expiryEstimated: false },
    ]);
  });

  it("số lượng 0 hoặc trống bị chặn", () => {
    const [line] = toEditableLines([draft()]);
    expect(reviewErrors([{ ...line, quantity: Number.NaN }], new Set())).toEqual({ l1: { quantity: "Nhập số lượng lớn hơn 0." } });
  });

  it("thông báo lưu/hoàn tác và lỗi hết lượt", () => {
    expect(commitMessage({ added: [{ action: "CREATED", name: "a" }, { action: "MERGED", name: "b" }] })).toBe("Đã thêm 2 thực phẩm từ hóa đơn vào kho.");
    expect(undoMessage({ restored: [{ name: "a", removed: true }], skipped: [{ itemName: "b", quantity: 1, unit: "ITEM", reason: "INSUFFICIENT" }] }))
      .toBe("Đã hoàn tác hóa đơn: trừ lại 1 thực phẩm. 1 dòng không trừ lại được vì đã dùng, đã sửa hoặc đã xóa.");
    expect(uploadErrorMessage(429, "Bạn đã quét 10 lần hôm nay.")).toBe("Bạn đã quét 10 lần hôm nay. Bạn vẫn có thể nhập tay.");
  });
});
