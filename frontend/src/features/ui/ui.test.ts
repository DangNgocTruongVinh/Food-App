import { describe, expect, it, vi } from "vitest";
import { createConfirmController, cx, fieldIds, greetingForHour } from "./ui.logic";

describe("cx", () => {
  it("joins truthy class names only", () => {
    expect(cx("ui-button", false, "is-primary", undefined, null, "")).toBe("ui-button is-primary");
  });
});

describe("fieldIds", () => {
  it("points aria-describedby only at the hint/error that is shown", () => {
    expect(fieldIds("email", {})).toEqual({ hintId: "email-hint", errorId: "email-error", describedBy: undefined, invalid: false });
    expect(fieldIds("email", { hint: "Dùng email đăng ký" }).describedBy).toBe("email-hint");
    expect(fieldIds("email", { hint: "Gợi ý", error: "Email chưa đúng" })).toMatchObject({ describedBy: "email-hint email-error", invalid: true });
  });
});

describe("createConfirmController", () => {
  const options = { title: "Xóa thực đơn Tuần 44?", description: "Không khôi phục được.", confirmLabel: "Xóa thực đơn" };

  it("opens with defaults (Hủy, danger) and resolves with the answer, then closes", async () => {
    const onChange = vi.fn();
    const controller = createConfirmController(onChange);
    const result = controller.request(options);
    expect(onChange).toHaveBeenLastCalledWith({ ...options, cancelLabel: "Hủy", tone: "danger" });
    expect(controller.current?.title).toBe(options.title);
    controller.answer(true);
    await expect(result).resolves.toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(controller.current).toBeNull();
  });

  it("resolves false on cancel", async () => {
    const controller = createConfirmController(() => undefined);
    const result = controller.request({ ...options, tone: "default", cancelLabel: "Để sau" });
    expect(controller.current).toMatchObject({ tone: "default", cancelLabel: "Để sau" });
    controller.answer(false);
    await expect(result).resolves.toBe(false);
  });

  it("treats a still-open request as cancelled when a new one arrives; extra answers are ignored", async () => {
    const controller = createConfirmController(() => undefined);
    const first = controller.request(options);
    const second = controller.request({ ...options, title: "Xóa bài viết?" });
    await expect(first).resolves.toBe(false);
    expect(controller.current?.title).toBe("Xóa bài viết?");
    controller.answer(true);
    controller.answer(false);
    await expect(second).resolves.toBe(true);
  });
});

describe("greetingForHour", () => {
  it.each([[6, "Chào buổi sáng"], [12, "Chào buổi trưa"], [15, "Chào buổi chiều"], [20, "Chào buổi tối"]])("%i giờ → %s", (hour, text) => {
    expect(greetingForHour(hour)).toBe(text);
  });
});
