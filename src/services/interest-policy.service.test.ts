import { describe, expect, it } from "vitest";
import {
  getEffectiveInterestRateBps,
  getLatestFreezeEventAt,
  isInterestFrozenAt,
  type InterestFreezeEvent,
  type InterestRateChange,
} from "@/services/interest-policy.service";

const freezeEvents: InterestFreezeEvent[] = [
  {
    action: "freeze",
    effective_date: "2026-01-10",
    reason: "Acuerdo temporal",
    created_at: "2026-01-10T12:00:00.000Z",
  },
  {
    action: "resume",
    effective_date: "2026-01-16",
    reason: "Fin del acuerdo",
    created_at: "2026-01-16T12:00:00.000Z",
  },
];

describe("interest freeze policy", () => {
  it("cancels the upcoming close when frozen during the cycle", () => {
    expect(isInterestFrozenAt(freezeEvents, "2026-01-15")).toBe(true);
  });

  it("does not retroactively reactivate a skipped close", () => {
    expect(getLatestFreezeEventAt(freezeEvents, "2026-01-15")?.action).toBe("freeze");
    expect(isInterestFrozenAt(freezeEvents, "2026-01-30")).toBe(false);
  });

  it("uses the latest event when status changes twice on the same date", () => {
    const events: InterestFreezeEvent[] = [
      {
        action: "freeze",
        effective_date: "2026-01-10",
        created_at: "2026-01-10T10:00:00.000Z",
      },
      {
        action: "resume",
        effective_date: "2026-01-10",
        created_at: "2026-01-10T11:00:00.000Z",
      },
    ];

    expect(isInterestFrozenAt(events, "2026-01-15")).toBe(false);
  });
});

describe("interest rate policy", () => {
  it("preserves the original rate before the effective close", () => {
    const changes: InterestRateChange[] = [{
      loan_id: "loan-a",
      effective_date: "2026-01-30",
      interest_rate_bps: 750,
      created_at: "2026-01-20T12:00:00.000Z",
    }];

    expect(getEffectiveInterestRateBps({ id: "loan-a", interest_rate_bps: 1_000 }, changes, "2026-01-15")).toBe(1_000);
    expect(getEffectiveInterestRateBps({ id: "loan-a", interest_rate_bps: 1_000 }, changes, "2026-01-30")).toBe(750);
  });

  it("does not apply one loan's rate change to another loan", () => {
    const changes: InterestRateChange[] = [{
      loan_id: "loan-a",
      effective_date: "2026-01-30",
      interest_rate_bps: 750,
      created_at: "2026-01-20T12:00:00.000Z",
    }];

    expect(getEffectiveInterestRateBps({ id: "loan-b", interest_rate_bps: 1_200 }, changes, "2026-01-30")).toBe(1_200);
  });
});

