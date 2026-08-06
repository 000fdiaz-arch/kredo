import { getNextCloseDate, listDueCycleRanges, toDateInputValue } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { getOrCreateCycle } from "@/services/cycles.service";
import type { Database } from "@/types/database";

type LoanRow = Database["public"]["Tables"]["loans"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type InterestChargeRow = Database["public"]["Tables"]["interest_charges"]["Row"];

export type InterestLoan = Pick<
  LoanRow,
  "loan_date" | "principal_amount_cents" | "interest_rate_bps" | "created_at" | "voided_at"
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

export function calculateCycleInterest(loans: InterestLoan[], payments: InterestPayment[], endDate: string) {
  const eligibleLoans = loans
    .filter((loan) => loan.loan_date <= endDate && !loan.voided_at)
    .sort((a, b) => a.loan_date.localeCompare(b.loan_date) || a.created_at.localeCompare(b.created_at));
  let principalPaidCents = payments
    .filter((payment) => payment.payment_date <= endDate && !payment.voided_at)
    .reduce((total, payment) => total + payment.principal_amount_cents, 0);

  const outstandingLoans = eligibleLoans.map((loan) => {
    const principalAppliedCents = Math.min(loan.principal_amount_cents, principalPaidCents);
    principalPaidCents -= principalAppliedCents;

    return {
      principalAmountCents: loan.principal_amount_cents - principalAppliedCents,
      interestRateBps: loan.interest_rate_bps,
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

async function listClientIdsWithLoans() {
  const { data, error } = await supabase
    .from("loans")
    .select("client_id")
    .is("voided_at", null);

  if (error) {
    throw error;
  }

  return [...new Set((data ?? []).map((loan) => loan.client_id))];
}

export async function getClientInterestStatus(clientId: string, asOfDate = toDateInputValue()): Promise<ClientInterestStatus> {
  const [loans, payments, charges] = await Promise.all([
    listClientLoans(clientId),
    listClientPayments(clientId),
    listClientInterestCharges(clientId),
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
      cycle: await getOrCreateCycle(firstLoan.user_id, range.endDate),
    })),
  );

  const dueCycles = cycles
    .map(({ range, cycle }) => {
      const interest = calculateCycleInterest(loans, payments, range.endDate);

      return {
        endDate: range.endDate,
        principalBaseCents: interest.principalBaseCents,
        interestAmountCents: interest.interestAmountCents,
        alreadyGenerated: generatedCycleIds.has(cycle.id),
      };
    })
    .filter((cycle) => cycle.principalBaseCents > 0);

  return {
    dueCycles,
    dueInterestCents: dueCycles
      .filter((cycle) => !cycle.alreadyGenerated)
      .reduce((total, cycle) => total + cycle.interestAmountCents, 0),
    nextCloseDate: getNextCloseDate(asOfDate),
  };
}

export async function generateDueInterestForClient(clientId: string, asOfDate = toDateInputValue()): Promise<InterestChargeRow[]> {
  const [loans, payments] = await Promise.all([listClientLoans(clientId), listClientPayments(clientId)]);
  const firstLoan = loans[0];

  if (!firstLoan) {
    return [];
  }

  const cycleRanges = listDueCycleRanges(firstLoan.loan_date, asOfDate);
  const created: InterestChargeRow[] = [];

  for (const range of cycleRanges) {
    const cycle = await getOrCreateCycle(firstLoan.user_id, range.endDate);
    const { data: existing, error: lookupError } = await supabase
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

    const interest = calculateCycleInterest(loans, payments, range.endDate);

    if (interest.principalBaseCents <= 0 || interest.interestAmountCents <= 0) {
      continue;
    }

    const { data, error } = await supabase
      .from("interest_charges")
      .insert({
        user_id: firstLoan.user_id,
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

export async function generateDueInterestForAllClients(): Promise<InterestChargeRow[]> {
  const clientIds = await listClientIdsWithLoans();
  const generated = await Promise.all(clientIds.map((clientId) => generateDueInterestForClient(clientId)));

  return generated.flat();
}
