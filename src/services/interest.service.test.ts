import { describe, expect, it } from "vitest";
import { calculateCycleInterest } from "@/services/interest.service";
import type { Database } from "@/types/database";

type LoanRow = Database["public"]["Tables"]["loans"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

function loan(input: Partial<LoanRow>): LoanRow {
  return {
    id: "loan-id",
    user_id: "user-id",
    client_id: "client-id",
    cycle_id: "cycle-id",
    loan_date: "2026-07-01",
    principal_amount_cents: 20_000,
    interest_rate_bps: 1_000,
    notes: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    voided_at: null,
    voided_by: null,
    void_reason: null,
    ...input,
  };
}

function payment(input: Partial<PaymentRow>): PaymentRow {
  return {
    id: "payment-id",
    user_id: "user-id",
    client_id: "client-id",
    cycle_id: "cycle-id",
    payment_date: "2026-07-10",
    total_amount_cents: 1_000,
    interest_amount_cents: 0,
    principal_amount_cents: 1_000,
    payment_method: "cash",
    reference_number: null,
    notes: null,
    overpayment_confirmed: false,
    created_at: "2026-07-10T00:00:00.000Z",
    updated_at: "2026-07-10T00:00:00.000Z",
    voided_at: null,
    voided_by: null,
    void_reason: null,
    ...input,
  };
}

describe("calculateCycleInterest", () => {
  it("calculates interest from outstanding principal at cycle close", () => {
    const interest = calculateCycleInterest(
      [loan({ principal_amount_cents: 20_000, interest_rate_bps: 1_000 })],
      [payment({ principal_amount_cents: 1_000 })],
      "2026-07-15",
    );

    expect(interest.principalBaseCents).toBe(19_000);
    expect(interest.interestAmountCents).toBe(1_900);
    expect(interest.weightedRateBps).toBe(1_000);
  });

  it("does not use principal payments made after the cycle close", () => {
    const interest = calculateCycleInterest(
      [loan({ principal_amount_cents: 20_000, interest_rate_bps: 1_000 })],
      [payment({ payment_date: "2026-07-16", principal_amount_cents: 1_000 })],
      "2026-07-15",
    );

    expect(interest.principalBaseCents).toBe(20_000);
    expect(interest.interestAmountCents).toBe(2_000);
  });
});
