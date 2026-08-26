import { getCycleRange, getNextCloseDate, getNextCycleRange, listDueCycleRanges, toDateInputValue } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { getOrCreateCycle } from "@/services/cycles.service";
import {
  getEffectiveInterestRateBps,
  isInterestFrozenAt,
  listClientInterestPolicyData,
  type InterestFreezeEvent,
  type InterestRateChange,
} from "@/services/interest-policy.service";
import type { Database } from "@/types/database";

type LoanRow = Database["public"]["Tables"]["loans"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type InterestChargeRow = Database["public"]["Tables"]["interest_charges"]["Row"];

export type InterestLoan = Pick<
  LoanRow,
  "id" | "loan_date" | "principal_amount_cents" | "interest_rate_bps" | "created_at" | "voided_at"
>;
export type InterestPayment = Pick<PaymentRow, "payment_date" | "principal_amount_cents" | "voided_at">;

export type InterestCyclePreview = {
  endDate: string;
  principalBaseCents: number;
  interestAmountCents: number;
  alreadyGenerated: boolean;
};

export type ClientInterestStatus = {
  dueCycles: InterestCyclePreview[];
  dueInterestCents: number;
  nextCloseDate: string;
};

export function calculateCycleInterest(
  loans: InterestLoan[],
  payments: InterestPayment[],
  endDate: string,
  rateChanges: InterestRateChange[] = [],
) {
  const eligibleLoans = loans
    // A loan granted on closing day starts accruing in the following cycle.
    .filter((loan) => loan.loan_date < endDate && !loan.voided_at)
    .sort((a, b) => a.loan_date.localeCompare(b.loan_date) || a.created_at.localeCompare(b.created_at));
  let principalPaidCents = payments
    .filter((payment) => payment.payment_date <= endDate && !payment.voided_at)
    .reduce((total, payment) => total + payment.principal_amount_cents, 0);

  const outstandingLoans = eligibleLoans.map((loan) => {
    const principalAppliedCents = Math.min(loan.principal_amount_cents, principalPaidCents);
    principalPaidCents -= principalAppliedCents;

    return {
      principalAmountCents: loan.principal_amount_cents - principalAppliedCents,
      interestRateBps: getEffectiveInterestRateBps(loan, rateChanges, endDate),
    };
  });
  const principalBaseCents = outstandingLoans.reduce((total, loan) => total + loan.principalAmountCents, 0);
  const interestAmountCents = outstandingLoans.reduce(
    (total, loan) => total + Math.round((loan.principalAmountCents * loan.interestRateBps) / 10000),
    0,
  );
  const weightedRateBps = principalBaseCents
    ? Math.round(
        outstandingLoans.reduce((total, loan) => total + loan.principalAmountCents * loan.interestRateBps, 0) /
          principalBaseCents,
      )
    : 0;

  return {
    principalBaseCents,
    interestAmountCents,
    weightedRateBps,
  };
}

export function calculateProjectedClientInterest(
  loans: InterestLoan[],
  payments: InterestPayment[],
  endDate: string,
  freezeEvents: InterestFreezeEvent[] = [],
  rateChanges: InterestRateChange[] = [],
) {
  if (isInterestFrozenAt(freezeEvents, endDate)) {
    return { principalBaseCents: 0, interestAmountCents: 0, weightedRateBps: 0 };
  }

  return calculateCycleInterest(loans, payments, endDate, rateChanges);
}

export async function getProjectedInterestForNextCycle(
  organizationId?: string,
  asOfDate = toDateInputValue(),
) {
  const nextCloseDate = getNextCloseDate(asOfDate);
  const endDate = nextCloseDate === asOfDate ? getNextCycleRange(asOfDate).endDate : nextCloseDate;
  let loansQuery = (supabase as any)
    .from("loans")
    .select("id, client_id, loan_date, principal_amount_cents, interest_rate_bps, created_at, voided_at")
    .is("voided_at", null)
    .lt("loan_date", endDate);
  let paymentsQuery = (supabase as any)
    .from("payments")
    .select("client_id, payment_date, principal_amount_cents, voided_at")
    .is("voided_at", null)
    .lte("payment_date", endDate);
  let freezeQuery = (supabase as any)
    .from("client_interest_freeze_events")
    .select("client_id, action, effective_date, reason, created_at");
  let rateQuery = (supabase as any)
    .from("loan_interest_rate_changes")
    .select("client_id, loan_id, effective_date, interest_rate_bps, reason, created_at");

  if (organizationId) {
    loansQuery = loansQuery.eq("organization_id", organizationId);
    paymentsQuery = paymentsQuery.eq("organization_id", organizationId);
    freezeQuery = freezeQuery.eq("organization_id", organizationId);
    rateQuery = rateQuery.eq("organization_id", organizationId);
  }

  const [loansResult, paymentsResult, freezeResult, rateResult] = await Promise.all([
    loansQuery,
    paymentsQuery,
    freezeQuery,
    rateQuery,
  ]);

  if (loansResult.error) throw loansResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (freezeResult.error) throw freezeResult.error;
  if (rateResult.error) throw rateResult.error;

  type ProjectedLoan = InterestLoan & { client_id: string };
  type ProjectedPayment = InterestPayment & { client_id: string };
  type ProjectedFreeze = InterestFreezeEvent & { client_id: string };
  type ProjectedRate = InterestRateChange & { client_id: string };
  const loans = (loansResult.data ?? []) as ProjectedLoan[];
  const payments = (paymentsResult.data ?? []) as ProjectedPayment[];
  const freezeEvents = (freezeResult.data ?? []) as ProjectedFreeze[];
  const rateChanges = (rateResult.data ?? []) as ProjectedRate[];
  const clientIds = [...new Set(loans.map((loan) => loan.client_id))];
  const clients = clientIds.map((clientId) => {
    const projection = calculateProjectedClientInterest(
      loans.filter((loan) => loan.client_id === clientId),
      payments.filter((payment) => payment.client_id === clientId),
      endDate,
      freezeEvents.filter((event) => event.client_id === clientId),
      rateChanges.filter((change) => change.client_id === clientId),
    );

    return { clientId, ...projection };
  }).filter((client) => client.principalBaseCents > 0 && client.interestAmountCents > 0);

  return {
    endDate,
    clients,
    totalInterestCents: clients.reduce((total, client) => total + client.interestAmountCents, 0),
  };
}

async function listClientLoans(clientId: string) {
  const { data, error } = await supabase
    .from("loans")
    .select("*")
    .eq("client_id", clientId)
    .is("voided_at", null)
    .order("loan_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listClientPayments(clientId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("client_id", clientId)
    .is("voided_at", null)
    .order("payment_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listClientInterestCharges(clientId: string) {
  const { data, error } = await supabase
    .from("interest_charges")
    .select("*")
    .eq("client_id", clientId)
    .is("voided_at", null);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listClientIdsWithLoans(organizationId?: string) {
  let query = (supabase as any)
    .from("loans")
    .select("client_id")
    .is("voided_at", null);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const loans = (data ?? []) as Array<{ client_id: string }>;
  return [...new Set(loans.map((loan) => loan.client_id))];
}

export function listPaymentInterestCycleRanges(startDateValue: string, paymentDateValue: string) {
  const ranges = listDueCycleRanges(startDateValue, paymentDateValue);
  const paymentCycle = getCycleRange(paymentDateValue);
  const existingEndDates = new Set(ranges.map((range) => range.endDate));

  if (startDateValue <= paymentCycle.endDate && !existingEndDates.has(paymentCycle.endDate)) {
    ranges.push(paymentCycle);
  }

  return ranges;
}

export async function getClientInterestStatus(clientId: string, asOfDate = toDateInputValue()): Promise<ClientInterestStatus> {
  const [loans, payments, charges, policyData] = await Promise.all([
    listClientLoans(clientId),
    listClientPayments(clientId),
    listClientInterestCharges(clientId),
    listClientInterestPolicyData(clientId),
  ]);
  const firstLoan = loans[0];

  if (!firstLoan) {
    return {
      dueCycles: [],
      dueInterestCents: 0,
      nextCloseDate: getNextCloseDate(asOfDate),
    };
  }

  const generatedCycleIds = new Set(charges.map((charge) => charge.cycle_id));
  const cycleRanges = listDueCycleRanges(firstLoan.loan_date, asOfDate);

  const cycles = await Promise.all(
    cycleRanges.map(async (range) => ({
      range,
      cycle: await getOrCreateCycle(firstLoan.user_id, (firstLoan as any).organization_id, range.endDate),
    })),
  );

  const dueCycles = cycles
    .map(({ range, cycle }) => {
      const interest = calculateCycleInterest(loans, payments, range.endDate, policyData.rateChanges);

      return {
        endDate: range.endDate,
        principalBaseCents: interest.principalBaseCents,
        interestAmountCents: interest.interestAmountCents,
        alreadyGenerated: generatedCycleIds.has(cycle.id),
        frozen: isInterestFrozenAt(policyData.freezeEvents, range.endDate),
      };
    })
    .filter((cycle) => cycle.principalBaseCents > 0 && !cycle.frozen);

  return {
    dueCycles,
    dueInterestCents: dueCycles
      .filter((cycle) => !cycle.alreadyGenerated)
      .reduce((total, cycle) => total + cycle.interestAmountCents, 0),
    nextCloseDate: getNextCloseDate(asOfDate),
  };
}

async function generateInterestForClient(
  clientId: string,
  asOfDate: string,
  getCycleRanges: (startDateValue: string, asOfDateValue: string) => Array<{ startDate: string; endDate: string }>,
): Promise<InterestChargeRow[]> {
  const [loans, payments, policyData] = await Promise.all([
    listClientLoans(clientId),
    listClientPayments(clientId),
    listClientInterestPolicyData(clientId),
  ]);
  const firstLoan = loans[0];

  if (!firstLoan) {
    return [];
  }

  const cycleRanges = getCycleRanges(firstLoan.loan_date, asOfDate);
  const created: InterestChargeRow[] = [];

  for (const range of cycleRanges) {
    if (isInterestFrozenAt(policyData.freezeEvents, range.endDate)) {
      continue;
    }

    const cycle = await getOrCreateCycle(firstLoan.user_id, (firstLoan as any).organization_id, range.endDate);
    const { data: existing, error: lookupError } = await (supabase as any)
      .from("interest_charges")
      .select("*")
      .eq("client_id", clientId)
      .eq("cycle_id", cycle.id)
      .is("voided_at", null)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (existing) {
      continue;
    }

    const interest = calculateCycleInterest(loans, payments, range.endDate, policyData.rateChanges);

    if (interest.principalBaseCents <= 0 || interest.interestAmountCents <= 0) {
      continue;
    }

    const { data, error } = await (supabase as any)
      .from("interest_charges")
      .insert({
        user_id: firstLoan.user_id,
        organization_id: (firstLoan as any).organization_id,
        client_id: clientId,
        cycle_id: cycle.id,
        principal_base_cents: interest.principalBaseCents,
        interest_rate_bps: interest.weightedRateBps,
        interest_amount_cents: interest.interestAmountCents,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    created.push(data);
  }

  return created;
}

export async function generateDueInterestForClient(clientId: string, asOfDate = toDateInputValue()): Promise<InterestChargeRow[]> {
  return generateInterestForClient(clientId, asOfDate, listDueCycleRanges);
}

export async function generatePaymentInterestForClient(clientId: string, paymentDate = toDateInputValue()): Promise<InterestChargeRow[]> {
  return generateInterestForClient(clientId, paymentDate, listPaymentInterestCycleRanges);
}

export async function generateDueInterestForAllClients(organizationId?: string): Promise<InterestChargeRow[]> {
  const clientIds = await listClientIdsWithLoans(organizationId);
  const generated = await Promise.all(clientIds.map((clientId) => generateDueInterestForClient(clientId)));

  return generated.flat();
}
