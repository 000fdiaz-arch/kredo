import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCyclePaymentBreakdown } from "@/services/cycle-payments.service";
import { getFinancialIndicators, listCycleProfitSummaries } from "@/services/financial-movements.service";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from } }));

type Row = Record<string, unknown>;

function query(rows: Row[]) {
  let filtered = rows;
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    is: vi.fn((key: string, value: unknown) => {
      filtered = filtered.filter((row) => row[key] === value);
      return chain;
    }),
    in: vi.fn((key: string, values: unknown[]) => {
      filtered = filtered.filter((row) => values.includes(row[key]));
      return chain;
    }),
    gte: vi.fn((key: string, value: string) => {
      filtered = filtered.filter((row) => String(row[key]) >= value);
      return chain;
    }),
    lte: vi.fn((key: string, value: string) => {
      filtered = filtered.filter((row) => String(row[key]) <= value);
      return chain;
    }),
    then: (resolve: (result: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: filtered, error: null }).then(resolve),
  };
  return chain;
}

function movement(id: string, date: string, type: string, amount: number, extra: Row = {}): Row {
  return {
    id, movement_date: date, movement_type: type, amount_cents: amount,
    created_at: `${date}T12:00:00Z`, client_id: "client-1", voided_at: null, ...extra,
  };
}

const movements = [
  movement("prior", "2026-08-15", "interest_income", 100),
  movement("interest-30", "2026-08-30", "interest_income", 1000),
  movement("interest-31", "2026-08-31", "interest_income", 2000),
  movement("fee-31", "2026-08-31", "late_fee_income", 300),
  movement("expense-31", "2026-08-31", "expense", 200),
  movement("loss-31", "2026-08-31", "loan_loss", 100),
  movement("principal-31", "2026-08-31", "principal_recovery", 5000),
  movement("withdrawal-31", "2026-08-31", "capital_withdrawal", 500, { source: "profit_withdrawal" }),
  movement("voided-31", "2026-08-31", "interest_income", 9999, { voided_at: "2026-09-01" }),
  movement("next", "2026-09-01", "interest_income", 400),
];

describe("calendar-day cycle reporting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 31, 12));
    from.mockImplementation((table: string) => {
      if (table === "financial_movements") return query(movements);
      if (table === "clients") return query([{ id: "client-1", full_name: "Cliente de prueba" }]);
      if (table === "interest_charges") return query([]);
      if (table === "payments") return query([
        { id: "prior", payment_date: "2026-08-15", total_amount_cents: 100, interest_amount_cents: 100, principal_amount_cents: 0, voided_at: null },
        { id: "payment-31", payment_date: "2026-08-31", total_amount_cents: 7000, interest_amount_cents: 2000, principal_amount_cents: 5000, voided_at: null },
        { id: "voided", payment_date: "2026-08-31", total_amount_cents: 9999, interest_amount_cents: 9999, principal_amount_cents: 0, voided_at: "2026-09-01" },
        { id: "next", payment_date: "2026-09-01", total_amount_cents: 400, interest_amount_cents: 400, principal_amount_cents: 0, voided_at: null },
      ]);
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps August 31 in August history after September begins, with the correct displayed end date", async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 12));
    const cycles = await listCycleProfitSummaries();
    const august = cycles.find((cycle) => cycle.startDate === "2026-08-16")!;
    expect(august).toMatchObject({
      endDate: "2026-08-31", interestCollectedCents: 3000, lateFeeIncomeCents: 300,
      expensesCents: 200, loanLossCents: 100, netProfitCents: 3000, profitWithdrawnCents: 500,
    });
    expect(august.sources.map((source) => source.id).sort()).toEqual([
      "expense-31", "fee-31", "interest-30", "interest-31", "loss-31",
    ]);
    expect(august.sources.find((source) => source.id === "interest-31")).toMatchObject({
      date: "2026-08-31", label: "Interés cobrado · Cliente de prueba", amountCents: 2000,
    });
    expect(cycles.find((cycle) => cycle.startDate === "2026-09-01")?.netProfitCents).toBe(400);
    expect(cycles.reduce((sum, cycle) => sum + cycle.netProfitCents, 0)).toBe(3500);
  });

  it("includes day 31 in current financial indicators without counting principal as profit", async () => {
    const indicators = await getFinancialIndicators(0);
    expect(indicators).toMatchObject({
      currentCycleStartDate: "2026-08-16", currentCycleEndDate: "2026-08-31",
      cycleNetProfitCents: 3000, cyclePrincipalRecoveredCents: 5000, cycleProfitWithdrawnCents: 500,
    });
  });

  it("uses the same inclusive dates for payment totals and the dashboard period label", async () => {
    const payments = await getCurrentCyclePaymentBreakdown();
    expect(payments).toMatchObject({
      startDate: "2026-08-16", endDate: "2026-08-31",
      totalPaymentsCents: 7000, interestCollectedCents: 2000, principalRecoveredCents: 5000,
    });
    expect(payments.payments.map((payment) => payment.id)).toEqual(["payment-31"]);
  });
});
