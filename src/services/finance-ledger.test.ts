import { describe, expect, it } from "vitest";
import { calculateFinancialSummary, type FinancialMovementInput } from "@/services/finance-ledger";

function movement(movement_type: FinancialMovementInput["movement_type"], amount_cents: number): FinancialMovementInput {
  return { movement_type, amount_cents };
}

describe("financial ledger summary", () => {
  it("separates recovered capital from new contributed capital when money rotates", () => {
    const summary = calculateFinancialSummary([
      movement("capital_contribution", 5_000),
      movement("loan_disbursement", 5_000),
      movement("principal_recovery", 5_000),
      movement("interest_income", 500),
      movement("loan_disbursement", 3_000),
      movement("loan_disbursement", 2_500),
    ]);

    expect(summary.capitalContributedCents).toBe(5_000);
    expect(summary.netContributedCapitalCents).toBe(5_000);
    expect(summary.interestCollectedCents).toBe(500);
    expect(summary.loanVolumeCents).toBe(10_500);
    expect(summary.activePortfolioCents).toBe(5_500);
    expect(summary.availableCashCents).toBe(0);
    expect(summary.netProfitCents).toBe(500);
    expect(summary.capitalRotation).toBeCloseTo(2.1);
  });

  it("keeps partial payment components balanced", () => {
    const paymentTotalCents = 2_500;
    const interestAppliedCents = 1_000;
    const principalAppliedCents = 1_500;
    const summary = calculateFinancialSummary([
      movement("capital_contribution", 10_000),
      movement("loan_disbursement", 10_000),
      movement("interest_income", interestAppliedCents),
      movement("principal_recovery", principalAppliedCents),
    ]);

    expect(interestAppliedCents + principalAppliedCents).toBe(paymentTotalCents);
    expect(summary.activePortfolioCents).toBe(8_500);
    expect(summary.interestCollectedCents).toBe(1_000);
    expect(summary.principalRecoveredCents).toBe(1_500);
  });

  it("treats additional owner money as contributed capital", () => {
    const summary = calculateFinancialSummary([
      movement("capital_contribution", 5_000),
      movement("capital_contribution", 10_000),
    ]);

    expect(summary.capitalContributedCents).toBe(15_000);
    expect(summary.netContributedCapitalCents).toBe(15_000);
    expect(summary.availableCashCents).toBe(15_000);
  });

  it("keeps historical interest income when profits are withdrawn", () => {
    const summary = calculateFinancialSummary([
      movement("capital_contribution", 5_000),
      movement("interest_income", 3_000),
      movement("capital_withdrawal", 2_000),
    ]);

    expect(summary.loanVolumeCents).toBe(0);
    expect(summary.availableCashCents).toBe(6_000);
    expect(summary.interestCollectedCents).toBe(3_000);
    expect(summary.capitalWithdrawnCents).toBe(2_000);
  });

  it("records charge-offs as losses instead of withdrawals or recoveries", () => {
    const summary = calculateFinancialSummary([
      movement("capital_contribution", 10_000),
      movement("loan_disbursement", 10_000),
      movement("loan_loss", 4_000),
    ]);

    expect(summary.activePortfolioCents).toBe(6_000);
    expect(summary.netProfitCents).toBe(-4_000);
    expect(summary.capitalWithdrawnCents).toBe(0);
    expect(summary.principalRecoveredCents).toBe(0);
  });
});
