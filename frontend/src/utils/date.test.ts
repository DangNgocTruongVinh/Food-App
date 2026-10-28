import { describe, expect, it } from "vitest";
import { formatDayMonth, formatDisplayDate, isoDateToDisplay, maskDateInput, parseDisplayDate, resolveDateDraft } from "./date";

describe("parseDisplayDate (dd/mm/yyyy → yyyy-MM-dd)", () => {
  it.each([
    ["30/10/2026", "2026-10-30"],
    ["01/02/2026", "2026-02-01"],
    ["1/2/2026", "2026-02-01"],
    [" 29/02/2028 ", "2028-02-29"],
    ["31/12/2100", "2100-12-31"],
  ])("parses %s", (text, iso) => {
    expect(parseDisplayDate(text)).toBe(iso);
  });

  it.each([
    "", "30/10", "30/10/26", "10-30-2026", "2026-10-30", "abc",
    "31/02/2026", "29/02/2027", "00/10/2026", "32/01/2026", "15/13/2026", "15/00/2026",
    "01/01/1899", "01/01/2101",
  ])("rejects %s", (text) => {
    expect(parseDisplayDate(text)).toBeNull();
  });

  it("reads day before month, never month before day", () => {
    expect(parseDisplayDate("05/10/2026")).toBe("2026-10-05");
    expect(parseDisplayDate("10/05/2026")).toBe("2026-05-10");
  });
});

describe("isoDateToDisplay (yyyy-MM-dd → dd/mm/yyyy)", () => {
  it("formats the API value without timezone shifts", () => {
    expect(isoDateToDisplay("2026-10-30")).toBe("30/10/2026");
    expect(isoDateToDisplay("2026-01-01")).toBe("01/01/2026");
  });
  it.each(["", "2026-10-30T00:00:00.000Z", "30/10/2026"])("returns empty for %s", (value) => {
    expect(isoDateToDisplay(value)).toBe("");
  });
  it("round-trips with parseDisplayDate", () => {
    expect(parseDisplayDate(isoDateToDisplay("2028-02-29"))).toBe("2028-02-29");
  });
});

describe("maskDateInput", () => {
  it.each([
    ["3", "3"], ["30", "30"], ["301", "30/1"], ["3010", "30/10"], ["30102", "30/10/2"],
    ["30102026", "30/10/2026"], ["301020261", "30/10/2026"], ["30a10b2026", "30/10/2026"],
  ])("auto-inserts slashes for digits %s", (raw, masked) => {
    expect(maskDateInput(raw)).toBe(masked);
  });
  it("keeps the user's own slashes and strips other characters", () => {
    expect(maskDateInput("3/1/2026")).toBe("3/1/2026");
    expect(maskDateInput("3/1.2026x")).toBe("3/12026");
    expect(maskDateInput("30/10/2026999")).toBe("30/10/2026");
  });
});

describe("display formatting", () => {
  it("shows dates as dd/mm/yyyy and dd/mm", () => {
    const date = new Date(2026, 9, 5, 12, 0);
    expect(formatDisplayDate(date)).toBe("05/10/2026");
    expect(formatDayMonth(date)).toBe("05/10");
  });
});

describe("resolveDateDraft (optional date fields)", () => {
  it.each(["", "   "])("treats %j as empty, not invalid", (draft) => {
    expect(resolveDateDraft(draft)).toEqual({ value: "", status: "empty" });
  });
  it("returns the API value for a valid date", () => {
    expect(resolveDateDraft("30/10/2026")).toEqual({ value: "2026-10-30", status: "valid" });
  });
  it.each(["3", "30/10", "31/02/2026", "30/10/20"])("marks %s as invalid with no API value", (draft) => {
    expect(resolveDateDraft(draft)).toEqual({ value: "", status: "invalid" });
  });
});
