import { describe, expect, it } from "vitest";
import { buildWeeklySeries, statsRangeStart, vietnamWeekStart } from "./admin-stats.logic.js";

describe("Vietnam week boundaries (Asia/Ho_Chi_Minh, weeks start on Monday)", () => {
  it("puts Sunday 23:59 Vietnam time in the previous week and Monday 00:00 in the new week", () => {
    // Thứ Hai 02/11/2026 00:00 giờ Việt Nam = Chủ nhật 01/11/2026 17:00 UTC.
    expect(vietnamWeekStart(new Date("2026-11-01T16:59:59.999Z")).key).toBe("2026-10-26");
    expect(vietnamWeekStart(new Date("2026-11-01T17:00:00.000Z")).key).toBe("2026-11-02");
  });

  it("returns the UTC instant of Monday 00:00 Vietnam time", () => {
    expect(vietnamWeekStart(new Date("2026-11-04T05:00:00.000Z")))
      .toEqual({ key: "2026-11-02", start: new Date("2026-11-01T17:00:00.000Z") });
  });

  it("uses Vietnam time even when the UTC date is still the previous day", () => {
    // Thứ Hai 01:00 giờ Việt Nam vẫn là Chủ nhật theo UTC.
    expect(vietnamWeekStart(new Date("2026-11-01T18:00:00.000Z")).key).toBe("2026-11-02");
  });

  it("covers 12 weeks including the current one", () => {
    expect(statsRangeStart(new Date("2026-11-04T05:00:00.000Z"))).toEqual(new Date("2026-08-16T17:00:00.000Z"));
  });
});

describe("buildWeeklySeries", () => {
  const now = new Date("2026-11-04T05:00:00.000Z");

  it("returns 12 weeks oldest first, filling empty weeks with 0", () => {
    const rows = buildWeeklySeries(now, { users: [], posts: [] });
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ weekStart: "2026-08-17", users: 0, posts: 0 });
    expect(rows[11]).toEqual({ weekStart: "2026-11-02", users: 0, posts: 0 });
  });

  it("counts each series in the right Vietnam week and ignores dates outside the range", () => {
    const rows = buildWeeklySeries(now, {
      users: [new Date("2026-11-01T16:59:00.000Z"), new Date("2026-11-01T17:01:00.000Z"), new Date("2026-11-03T00:00:00.000Z")],
      posts: [new Date("2026-08-16T16:59:00.000Z"), new Date("2026-08-16T17:00:00.000Z")],
    });
    expect(rows[10]).toMatchObject({ weekStart: "2026-10-26", users: 1 });
    expect(rows[11]).toMatchObject({ weekStart: "2026-11-02", users: 2 });
    expect(rows[0]).toMatchObject({ weekStart: "2026-08-17", posts: 1 });
    expect(rows.reduce((sum, row) => sum + row.posts, 0)).toBe(1);
  });
});
