import { describe, expect, it } from "vitest";
import { reasoningOption } from "./openai-options.js";

describe("reasoningOption: chỉ model suy luận nhận tham số reasoning", () => {
  it("gpt-5* nhận mức suy luận; model khác không có tham số này", () => {
    expect(reasoningOption("gpt-5-mini", "low")).toEqual({ reasoning: { effort: "low" } });
    expect(reasoningOption("gpt-5", "minimal")).toEqual({ reasoning: { effort: "minimal" } });
    expect(reasoningOption("gpt-4o-mini", "low")).toEqual({});
  });
});
