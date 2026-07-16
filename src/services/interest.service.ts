import { getNextCloseDate, listDueCycleRanges, toDateInputValue } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { getOrCreateCycle } from "@/services/cycles.service";
import type { Database } from "@/types/database";

type LoanRow = Database["public"]["Tables"]["loans"]["Row"];
type InterestChargeRow = Database["public"]["Tables"]["interest_charges"]["Row"];

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

function calculateCycleInterest(loans: LoanRow[], endDate: string) {
  const eligibleLoans = loans.filter((loan) => loan.loan_date <= endDate && !loan.voided_at);
  const principalBaseCents = eligibleLoans.reduce((total, loan) => total + loan.principal_amount_cents, 0);
  const interestAmountCents = eligibleLoans.reduce(
    (total, loan) => total + Math.round((loan.principal_amount_cents * loan.interest_rate_bps) / 10000),
    0,
  );
  const weightedRateBps = principalBaseCents
    ? Math.round(
        eligibleLoans.reduce((total, loan) => total + loan.principal_amount_cents * loan.interest_rate_bps, 0) /
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

export async function getClientInterestStatus(clientId: string): Promise<ClientInterestStatus> {
  const asOfDate = toDateInputValue();
  const [loans, charges] = await Promise.all([listClientLoans(clientId), listClientInterestCharges(clientId)]);
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
      const interest = calculateCycleInterest(loans, range.endDate);

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

export async function generateDueInterestForClient(clientId: string): Promise<InterestChargeRow[]> {
  const asOfDate = toDateInputValue();
  const loans = await listClientLoans(clientId);
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

    const interest = calculateCycleInterest(loans, range.endDate);

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
