import { describe, expect, it } from "vitest";
import { filterReportData, validateDateRange, type ReportData } from "@/services/reports.service";

const data = {
  clients: [
    { id: "client-1", status: "current", balance: null },
    { id: "client-2", status: "late", balance: null },
  ],
  movements: [
    { client_id: "client-1", movement_date: "2026-08-01", movement_type: "payment", voided_at: null },
    { client_id: "client-1", movement_date: "2026-07-01", movement_type: "loan", voided_at: null },
    { client_id: "client-2", movement_date: "2026-08-02", movement_type: "payment", voided_at: "2026-08-03" },
  ],
} as ReportData;

describe("report filters", () => {
  it("rejects an inverted date range", () => {
    expect(() => validateDateRange("2026-08-02", "2026-08-01")).toThrow(/fecha inicial/i);
  });

  it("filters by date, client status and movement type", () => {
    const result = filterReportData(data, {
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      status: "current",
      movementType: "payment",
      includeVoided: false,
    });
    expect(result.clients).toHaveLength(1);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].client_id).toBe("client-1");
  });

  it("excludes voided movements unless requested", () => {
    const baseFilters = { startDate: "", endDate: "", status: "all" as const, movementType: "all" as const };
    expect(filterReportData(data, { ...baseFilters, includeVoided: false }).movements).toHaveLength(2);
    expect(filterReportData(data, { ...baseFilters, includeVoided: true }).movements).toHaveLength(3);
  });
});
