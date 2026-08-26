import { describe, expect, it } from "vitest";
import { calculateCycleInterest, calculateGeneratedInterestCollection, calculateProjectedClientInterest, getUpcomingProjectionEndDates, listPaymentInterestCycleRanges } from "@/services/interest.service";
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

  it("charges a loan granted on January 5 at the January 15 close", () => {
    const interest = calculateCycleInterest(
      [loan({ loan_date: "2026-01-05", principal_amount_cents: 10_000, interest_rate_bps: 1_000 })],
      [],
      "2026-01-15",
    );

    expect(interest.interestAmountCents).toBe(1_000);
  });

  it("does not charge a loan granted on closing day until the following close", () => {
    const january15 = calculateCycleInterest(
      [loan({ loan_date: "2026-01-15", principal_amount_cents: 5_500, interest_rate_bps: 1_000 })],
      [],
      "2026-01-15",
    );
    const january30 = calculateCycleInterest(
      [loan({ loan_date: "2026-01-15", principal_amount_cents: 5_500, interest_rate_bps: 1_000 })],
      [],
      "2026-01-30",
    );

    expect(january15.interestAmountCents).toBe(0);
    expect(january30.interestAmountCents).toBe(550);
  });

  it("charges a loan granted on January 16 at the January 30 close", () => {
    const interest = calculateCycleInterest(
      [loan({ loan_date: "2026-01-16", principal_amount_cents: 20_000, interest_rate_bps: 1_000 })],
      [],
      "2026-01-30",
    );

    expect(interest.interestAmountCents).toBe(2_000);
  });

  it("uses a new rate only from its effective close", () => {
    const rateChanges = [{
      loan_id: "loan-id",
      effective_date: "2026-01-30",
      interest_rate_bps: 500,
      created_at: "2026-01-20T12:00:00.000Z",
    }];
    const loans = [loan({ loan_date: "2026-01-05", principal_amount_cents: 10_000, interest_rate_bps: 1_000 })];

    expect(calculateCycleInterest(loans, [], "2026-01-15", rateChanges).interestAmountCents).toBe(1_000);
    expect(calculateCycleInterest(loans, [], "2026-01-30", rateChanges).interestAmountCents).toBe(500);
  });
});

describe("listPaymentInterestCycleRanges", () => {
  it("prepares the January 15 charge for a manual payment on January 10", () => {
    expect(listPaymentInterestCycleRanges("2026-01-05", "2026-01-10")).toEqual([
      { startDate: "2026-01-01", endDate: "2026-01-15" },
    ]);
  });

  it("moves a loan from January 15 to the January 30 close", () => {
    expect(listPaymentInterestCycleRanges("2026-01-15", "2026-01-30")).toEqual([
      { startDate: "2026-01-01", endDate: "2026-01-15" },
      { startDate: "2026-01-16", endDate: "2026-01-30" },
    ]);
  });

  it("uses the January 30 close for a loan granted on January 16", () => {
    expect(listPaymentInterestCycleRanges("2026-01-16", "2026-01-30")).toEqual([
      { startDate: "2026-01-16", endDate: "2026-01-30" },
    ]);
  });

  it("includes the payment cycle even before the close date", () => {
    expect(listPaymentInterestCycleRanges("2026-08-01", "2026-08-06")).toEqual([
      { startDate: "2026-08-01", endDate: "2026-08-15" },
    ]);
  });

  it("does not duplicate a cycle when payment happens on the close date", () => {
    expect(listPaymentInterestCycleRanges("2026-08-01", "2026-08-15")).toEqual([
      { startDate: "2026-08-01", endDate: "2026-08-15" },
    ]);
  });
});

describe("calculateProjectedClientInterest", () => {
  it("projects interest from the current principal and rate", () => {
    const projection = calculateProjectedClientInterest(
      [loan({ loan_date: "2026-08-01", principal_amount_cents: 25_000, interest_rate_bps: 1_000 })],
      [payment({ payment_date: "2026-08-10", principal_amount_cents: 5_000 })],
      "2026-08-15",
    );

    expect(projection.principalBaseCents).toBe(20_000);
    expect(projection.interestAmountCents).toBe(2_000);
  });

  it("does not project interest while the client is frozen", () => {
    const projection = calculateProjectedClientInterest(
      [loan({ loan_date: "2026-08-01", principal_amount_cents: 25_000, interest_rate_bps: 1_000 })],
      [],
      "2026-08-15",
      [{ action: "freeze", effective_date: "2026-08-10", created_at: "2026-08-10T12:00:00.000Z" }],
    );

    expect(projection.interestAmountCents).toBe(0);
  });
});

describe("calculateGeneratedInterestCollection", () => {
  it("marks a generated cycle as paid after older interest is covered", () => {
    expect(calculateGeneratedInterestCollection(790, 1_000, 1_790)).toEqual({
      collectedInterestCents: 790,
      pendingInterestCents: 0,
      status: "paid",
    });
  });

  it("keeps the unpaid portion of a generated cycle pending", () => {
    expect(calculateGeneratedInterestCollection(1_000, 500, 900)).toEqual({
      collectedInterestCents: 400,
      pendingInterestCents: 600,
      status: "pending",
    });
  });
});

describe("getUpcomingProjectionEndDates", () => {
  it("lists the next three closing dates beginning with the upcoming close", () => {
    expect(getUpcomingProjectionEndDates("2026-08-26")).toEqual([
      "2026-08-30",
      "2026-09-15",
      "2026-09-30",
    ]);
  });

  it("includes today when today is a closing day", () => {
    expect(getUpcomingProjectionEndDates("2026-08-30")).toEqual([
      "2026-08-30",
      "2026-09-15",
      "2026-09-30",
    ]);
  });
});
