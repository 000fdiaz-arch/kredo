import { describe, expect, it } from "vitest";
import { getCycleRange, getCycleReportingRange, getNextCloseDate, isCycleCloseDate, listDueCycleRanges } from "@/lib/dates";

describe("cycle reporting ranges", () => {
  it.each([
    ["2026-08-01", "2026-08-01", "2026-08-15"],
    ["2026-08-15", "2026-08-01", "2026-08-15"],
    ["2026-08-16", "2026-08-16", "2026-08-31"],
    ["2026-08-30", "2026-08-16", "2026-08-31"],
    ["2026-08-31", "2026-08-16", "2026-08-31"],
    ["2026-09-01", "2026-09-01", "2026-09-15"],
    ["2026-09-30", "2026-09-16", "2026-09-30"],
    ["2027-02-28", "2027-02-16", "2027-02-28"],
    ["2028-02-29", "2028-02-16", "2028-02-29"],
    ["2026-12-31", "2026-12-16", "2026-12-31"],
    ["2027-01-01", "2027-01-01", "2027-01-15"],
  ])("includes %s in the displayed calendar range", (date, startDate, endDate) => {
    expect(getCycleReportingRange(date)).toEqual({ startDate, endDate });
    expect(date >= startDate && date <= endDate).toBe(true);
  });

  it("covers every day exactly once across normal and leap years", () => {
    for (const year of [2026, 2028]) {
      for (let month = 1; month <= 12; month++) {
        const prefix = `${year}-${String(month).padStart(2, "0")}`;
        const ranges = [getCycleReportingRange(`${prefix}-01`), getCycleReportingRange(`${prefix}-16`)];
        const lastDay = new Date(year, month, 0).getDate();
        for (let day = 1; day <= lastDay; day++) {
          const date = `${prefix}-${String(day).padStart(2, "0")}`;
          expect(ranges.filter((range) => date >= range.startDate && date <= range.endDate)).toHaveLength(1);
        }
      }
    }
  });

  it("preserves operational closes and interest generation dates", () => {
    expect(getCycleRange("2026-08-31").endDate).toBe("2026-08-30");
    expect(isCycleCloseDate("2026-08-30")).toBe(true);
    expect(isCycleCloseDate("2026-08-31")).toBe(false);
    expect(getNextCloseDate("2026-08-31")).toBe("2026-09-15");
    expect(listDueCycleRanges("2026-08-16", "2026-09-15")).toEqual([
      { startDate: "2026-08-16", endDate: "2026-08-30" },
      { startDate: "2026-09-01", endDate: "2026-09-15" },
    ]);
  });
});
