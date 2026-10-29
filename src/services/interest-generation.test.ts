import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDueInterestForClient, getClientInterestStatus, getProjectedInterestForUpcomingCycles } from "@/services/interest.service";

const { from, getCycle } = vi.hoisted(() => ({ from: vi.fn(), getCycle: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from } }));
vi.mock("@/services/cycles.service", () => ({ getOrCreateCycle: getCycle }));

type Row = Record<string, any>;
let tables: Record<string, Row[]>;

function query(table: string) {
  let rows = tables[table] ?? [];
  let single = false;
  const chain = {
    select: () => chain,
    order: () => chain,
    eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return chain; },
    in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return chain; },
    is: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return chain; },
    lt: (key: string, value: string) => { rows = rows.filter((row) => row[key] < value); return chain; },
    lte: (key: string, value: string) => { rows = rows.filter((row) => row[key] <= value); return chain; },
    maybeSingle: () => { single = true; return chain; },
    single: () => { single = true; return chain; },
    insert: (row: Row) => {
      const created = { id: `new-${tables[table].length}`, voided_at: null, ...row };
      tables[table].push(created); rows = [created]; return chain;
    },
    then: (resolve: (result: any) => unknown) => Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve),
  };
  return chain;
}

describe("due interest generation and previews", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 12));
    getCycle.mockImplementation(async (_user, _org, date) => ({ id: date }));
    tables = {
      loans: [{ id: "loan", client_id: "client", user_id: "user", organization_id: "org", loan_date: "2026-08-16", principal_amount_cents: 18400, interest_rate_bps: 500, created_at: "2026-08-16T12:00:00Z", voided_at: null }],
      payments: [], interest_charges: [], client_interest_freeze_events: [], loan_interest_rate_changes: [],
      adjustments: [{ client_id: "client", organization_id: "org", adjustment_date: "2026-08-20", adjustment_type: "principal_decrease", principal_amount_cents: 660, voided_at: null }],
      cycles: [{ id: "2026-08-30", end_date: "2026-08-30" }],
    };
    from.mockImplementation(query);
  });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it("on September 1 generates only August 30 at 8.87, never September 15, and is repeat-safe", async () => {
    const created = await generateDueInterestForClient("client");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ cycle_id: "2026-08-30", principal_base_cents: 17740, interest_amount_cents: 887, interest_rate_bps: 500 });
    expect(await generateDueInterestForClient("client")).toEqual([]);
    expect(tables.interest_charges).toHaveLength(1);
  });

  it("does not generate before a close and uses the same adjusted amount in the preview", async () => {
    expect(await generateDueInterestForClient("client", "2026-08-29")).toEqual([]);
    const status = await getClientInterestStatus("client");
    expect(status.dueInterestCents).toBe(887);
    expect(status.dueCycles[0]).toMatchObject({ endDate: "2026-08-30", principalBaseCents: 17740, interestAmountCents: 887, alreadyGenerated: false });
  });

  it("shows the amount actually recorded for generated charges, not a different recalculation", async () => {
    tables.interest_charges.push({ client_id: "client", cycle_id: "2026-08-30", principal_base_cents: 18400, interest_amount_cents: 920, voided_at: null });
    const status = await getClientInterestStatus("client");
    expect(status.dueInterestCents).toBe(0);
    expect(status.dueCycles[0]).toMatchObject({ principalBaseCents: 18400, interestAmountCents: 920, alreadyGenerated: true });
  });

  it("includes capital adjustments in organization-scoped dashboard projections", async () => {
    const projections = await getProjectedInterestForUpcomingCycles("org", "2026-09-01", 1);
    expect(projections[0]).toMatchObject({ endDate: "2026-09-15", totalInterestCents: 887 });
  });

  it("explains a recorded 7.50 charge covered by 5.00 paid and a 2.50 adjustment", async () => {
    tables.cycles.push({ id: "2026-08-15", end_date: "2026-08-15" });
    tables.interest_charges.push(
      { client_id: "client", cycle_id: "2026-08-15", principal_base_cents: 20000, interest_amount_cents: 2000, voided_at: null },
      { client_id: "client", cycle_id: "2026-08-30", principal_base_cents: 7500, interest_amount_cents: 750, generated_at: "2026-08-18T02:34:18Z", voided_at: null },
    );
    tables.payments.push({ client_id: "client", payment_date: "2026-08-17", interest_amount_cents: 2500, principal_amount_cents: 0, voided_at: null });
    tables.adjustments.push({ client_id: "client", adjustment_date: "2026-08-20", adjustment_type: "interest_decrease", interest_amount_cents: 250, principal_amount_cents: 0, voided_at: null });
    const status = await getClientInterestStatus("client");
    expect(status.dueCycles.find((cycle) => cycle.endDate === "2026-08-30")).toMatchObject({
      interestAmountCents: 750, collectedInterestCents: 500, adjustedInterestCents: 250,
      pendingInterestCents: 0, generatedAt: "2026-08-18T02:34:18Z", alreadyGenerated: true, needsReview: true,
    });
    expect(status.dueInterestCents).toBe(0);
    expect(getCycle).not.toHaveBeenCalled();
  });

  it("preserves recorded cycles when no active loans remain", async () => {
    tables.loans = [];
    tables.interest_charges.push({ client_id: "client", cycle_id: "2026-08-30", principal_base_cents: 7500, interest_amount_cents: 750, voided_at: null });
    expect((await getClientInterestStatus("client")).dueCycles[0]).toMatchObject({ interestAmountCents: 750, pendingInterestCents: 750 });
  });
});
