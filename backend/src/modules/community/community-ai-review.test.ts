import { describe, expect, it, vi } from "vitest";
import { createPostReviewer, reviewData, reviewTextOf } from "./community-ai-review.js";

vi.mock("../../config/env.js", () => ({ env: { OPENAI_MODEL: "gpt-5-mini" } }));

// Client giả lập (Moderation API + Responses API), không gọi OpenAI thật.
function fakeClient({ flagged = false, categories = {}, foodRelated = true, moderationError, topicError }: {
  flagged?: boolean; categories?: Record<string, boolean>; foodRelated?: boolean; moderationError?: Error; topicError?: Error;
} = {}) {
  const moderations = { create: vi.fn(async () => {
    if (moderationError) throw moderationError;
    return { results: [{ flagged, categories }] };
  }) };
  const responses = { create: vi.fn(async () => {
    if (topicError) throw topicError;
    return { output_text: JSON.stringify({ foodRelated, reason: foodRelated ? "Bài về món ăn." : "Quảng cáo bán điện thoại." }) };
  }) };
  return { client: { moderations, responses } as never, moderations, responses };
}
const post = { text: "Hôm nay mình nấu canh chua cá lóc.", imageUrls: ["https://res.cloudinary.com/demo/a.jpg"] };

describe("createPostReviewer", () => {
  it("bài sạch, liên quan ăn uống → không đánh dấu; gửi cả chữ và ảnh, có timeout, không thử lại", async () => {
    const fake = fakeClient();
    await expect(createPostReviewer(fake.client, "gpt-5-mini")(post)).resolves.toEqual({ flagged: false, reason: null });
    const [body, options] = fake.moderations.create.mock.calls[0] as unknown as [{ model: string; input: unknown[] }, object];
    expect(body.model).toBe("omni-moderation-latest");
    expect(body.input).toEqual([{ type: "text", text: post.text }, { type: "image_url", image_url: { url: post.imageUrls[0] } }]);
    expect(options).toEqual({ timeout: 15_000, maxRetries: 0 });
  });

  it("Moderation API đánh dấu → lý do nêu nhóm vi phạm bằng tiếng Việt", async () => {
    const fake = fakeClient({ flagged: true, categories: { violence: true, "violence/graphic": true, hate: false } });
    await expect(createPostReviewer(fake.client, "m")(post)).resolves.toEqual({ flagged: true, reason: "Nội dung nhạy cảm (bạo lực)" });
  });

  it("không liên quan ăn uống → đánh dấu kèm lý do của model", async () => {
    const fake = fakeClient({ foodRelated: false });
    const review = await createPostReviewer(fake.client, "m")({ text: "Bán điện thoại giá rẻ", imageUrls: [] });
    expect(review).toEqual({ flagged: true, reason: "Có thể không liên quan ăn uống: Quảng cáo bán điện thoại." });
  });

  it("Moderation API lỗi/hết giờ → null (đăng như thường)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fake = fakeClient({ moderationError: new Error("timeout") });
    await expect(createPostReviewer(fake.client, "m")(post)).resolves.toBeNull();
    expect(fake.responses.create).not.toHaveBeenCalled();
  });

  it("bước kiểm chủ đề lỗi → chỉ dùng kết quả Moderation", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const clean = fakeClient({ topicError: new Error("500") });
    await expect(createPostReviewer(clean.client, "m")(post)).resolves.toEqual({ flagged: false, reason: null });
    const flagged = fakeClient({ flagged: true, categories: { harassment: true }, topicError: new Error("500") });
    await expect(createPostReviewer(flagged.client, "m")(post)).resolves.toEqual({ flagged: true, reason: "Nội dung nhạy cảm (quấy rối)" });
  });

  it("không có key → null, không gọi API", async () => {
    await expect(createPostReviewer(null, "m")(post)).resolves.toBeNull();
  });
});

describe("reviewData, reviewTextOf", () => {
  it("nghi vấn → chờ duyệt kèm lý do; sạch → bỏ chờ duyệt; không kiểm được → không đổi", () => {
    const now = new Date("2026-11-12T00:00:00.000Z");
    expect(reviewData({ flagged: true, reason: "x" }, now)).toEqual({ pendingReviewAt: now, aiReviewReason: "x" });
    expect(reviewData({ flagged: false, reason: null }, now)).toEqual({ pendingReviewAt: null, aiReviewReason: null });
    expect(reviewData(null, now)).toEqual({});
  });

  it("công thức tự viết cũng được đem đi kiểm", () => {
    const text = reviewTextOf("Chia sẻ", { name: "Gỏi cuốn", ingredients: [{ name: "Bánh tráng" }], steps: ["Cuốn"] });
    expect(text.split("\n")).toEqual(["Chia sẻ", "Gỏi cuốn", "Bánh tráng", "Cuốn"]);
  });
});
