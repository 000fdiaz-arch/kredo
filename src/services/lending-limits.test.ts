import { describe, expect, it } from "vitest";
import { calculateLendingLimitGuidance } from "@/services/lending-limits";

describe("lending limit guidance", () => {
  it("uses 10%, 15%, and 20% cash thresholds per borrower", () => {
    const guidance = calculateLendingLimitGuidance(44_200, 6_700);

    expect(guidance.normalLimitCents).toBe(4_420);
    expect(guidance.recommendedLimitCents).toBe(6_630);
    expect(guidance.exceptionalLimitCents).toBe(8_840);
    expect(guidance.riskLevel).toBe("exceptional");
  });

  it("marks a loan inside the normal concentration limit as ok", () => {
    const guidance = calculateLendingLimitGuidance(44_200, 4_000);

    expect(guidance.riskLevel).toBe("ok");
  });
});
