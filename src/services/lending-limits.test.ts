import { describe, expect, it } from "vitest";
import { calculateFundingShortfallCents, calculateLendingLimitGuidance } from "@/services/lending-limits";

describe("lending cash guidance", () => {
  it("calculates only the missing cash as a proposed capital contribution", () => {
    expect(calculateFundingShortfallCents(4_000, 10_000)).toBe(6_000);
    expect(calculateFundingShortfallCents(10_000, 4_000)).toBe(0);
  });

  it("includes an existing negative balance when calculating the amount to reconcile", () => {
    expect(calculateFundingShortfallCents(-65_700, 10_000)).toBe(75_700);
  });

  it("never presents negative lending limits", () => {
    const guidance = calculateLendingLimitGuidance(-65_700, 0);

    expect(guidance.normalLimitCents).toBe(0);
    expect(guidance.recommendedLimitCents).toBe(0);
    expect(guidance.exceptionalLimitCents).toBe(0);
    expect(guidance.riskLevel).toBe("ok");
  });
});
