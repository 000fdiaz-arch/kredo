import { getNextCloseDate, toDateInputValue } from "@/lib/dates";
import { supabase } from "@/lib/supabase";

export type InterestFreezeEvent = {
  id?: string;
  action: "freeze" | "resume";
  effective_date: string;
  reason?: string;
  created_at: string;
};

export type InterestRateChange = {
  id?: string;
  loan_id: string;
  effective_date: string;
  interest_rate_bps: number;
  reason?: string;
  created_at: string;
};

type LoanRateSource = {
  id: string;
  loan_date: string;
  interest_rate_bps: number;
  voided_at: string | null;
};

export type ClientInterestPolicyStatus = {
  isFrozen: boolean;
  frozenSince: string | null;
  currentRateBps: number | null;
  hasMixedRates: boolean;
  activeLoanCount: number;
  pendingRateBps: number | null;
  pendingRateEffectiveDate: string | null;
  recentEvents: Array<{
    id: string;
    type: "freeze" | "resume" | "rate_change";
    date: string;
    reason: string;
    rateBps: number | null;
  }>;
};

function compareEffectiveEvents(
  a: { effective_date: string; created_at: string },
  b: { effective_date: string; created_at: string },
) {
  return a.effective_date.localeCompare(b.effective_date) || a.created_at.localeCompare(b.created_at);
}

export function getLatestFreezeEventAt(events: InterestFreezeEvent[], dateValue: string) {
  const eligible = events.filter((event) => event.effective_date <= dateValue).sort(compareEffectiveEvents);
  return eligible[eligible.length - 1] ?? null;
}

export function isInterestFrozenAt(events: InterestFreezeEvent[], dateValue: string) {
  return getLatestFreezeEventAt(events, dateValue)?.action === "freeze";
}

export function getEffectiveInterestRateBps(
  loan: Pick<LoanRateSource, "id" | "interest_rate_bps">,
  changes: InterestRateChange[],
  dateValue: string,
) {
  const eligible = changes
    .filter((change) => change.loan_id === loan.id && change.effective_date <= dateValue)
    .sort(compareEffectiveEvents);
  return eligible[eligible.length - 1]?.interest_rate_bps ?? loan.interest_rate_bps;
}

export async function listClientInterestPolicyData(clientId: string) {
  const [freezeResult, rateResult] = await Promise.all([
    (supabase as any)
      .from("client_interest_freeze_events")
      .select("*")
      .eq("client_id", clientId)
      .order("effective_date", { ascending: true })
      .order("created_at", { ascending: true }),
    (supabase as any)
      .from("loan_interest_rate_changes")
      .select("*")
      .eq("client_id", clientId)
      .order("effective_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (freezeResult.error) throw freezeResult.error;
  if (rateResult.error) throw rateResult.error;

  return {
    freezeEvents: (freezeResult.data ?? []) as InterestFreezeEvent[],
    rateChanges: (rateResult.data ?? []) as InterestRateChange[],
  };
}

export async function getClientInterestPolicyStatus(
  clientId: string,
  asOfDate = toDateInputValue(),
): Promise<ClientInterestPolicyStatus> {
  const [{ freezeEvents, rateChanges }, loansResult] = await Promise.all([
    listClientInterestPolicyData(clientId),
    (supabase as any)
      .from("loans")
      .select("id, loan_date, interest_rate_bps, voided_at")
      .eq("client_id", clientId)
      .is("voided_at", null),
  ]);

  if (loansResult.error) throw loansResult.error;

  const loans = (loansResult.data ?? []) as LoanRateSource[];
  const activeLoans = loans.filter((loan) => loan.loan_date <= asOfDate && !loan.voided_at);
  const currentRates = [...new Set(activeLoans.map((loan) => getEffectiveInterestRateBps(loan, rateChanges, asOfDate)))];
  const latestFreeze = getLatestFreezeEventAt(freezeEvents, asOfDate);
  const pendingChanges = rateChanges.filter((change) => change.effective_date > asOfDate).sort(compareEffectiveEvents);
  const nextPendingDate = pendingChanges[0]?.effective_date ?? null;
  const ratesAtNextDate = nextPendingDate
    ? [...new Set(pendingChanges.filter((change) => change.effective_date === nextPendingDate).map((change) => change.interest_rate_bps))]
    : [];
  const recentEvents = [
    ...freezeEvents.map((event) => ({
      id: event.id ?? `${event.action}-${event.created_at}`,
      type: event.action,
      date: event.effective_date,
      reason: event.reason ?? "",
      rateBps: null,
      createdAt: event.created_at,
    })),
    ...rateChanges.map((change) => ({
      id: change.id ?? `${change.loan_id}-${change.created_at}`,
      type: "rate_change" as const,
      date: change.effective_date,
      reason: change.reason ?? "",
      rateBps: change.interest_rate_bps,
      createdAt: change.created_at,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((event, index, all) => (
      event.type !== "rate_change" ||
      all.findIndex((candidate) => (
        candidate.type === "rate_change" &&
        candidate.date === event.date &&
        candidate.rateBps === event.rateBps &&
        candidate.reason === event.reason
      )) === index
    ))
    .slice(0, 5)
    .map(({ createdAt: _createdAt, ...event }) => event);

  return {
    isFrozen: latestFreeze?.action === "freeze",
    frozenSince: latestFreeze?.action === "freeze" ? latestFreeze.effective_date : null,
    currentRateBps: currentRates.length === 1 ? currentRates[0] : null,
    hasMixedRates: currentRates.length > 1,
    activeLoanCount: activeLoans.length,
    pendingRateBps: ratesAtNextDate.length === 1 ? ratesAtNextDate[0] : null,
    pendingRateEffectiveDate: nextPendingDate,
    recentEvents,
  };
}

type PolicyActionInput = {
  userId: string;
  organizationId: string;
  clientId: string;
  reason: string;
  effectiveDate?: string;
};

async function createFreezeEvent(input: PolicyActionInput, action: "freeze" | "resume") {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Reason is required");

  const { data, error } = await (supabase as any)
    .from("client_interest_freeze_events")
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      client_id: input.clientId,
      action,
      effective_date: input.effectiveDate ?? toDateInputValue(),
      reason,
    })
    .select("*")
    .single();

  if (error) throw error;

  await (supabase as any).from("audit_logs").insert({
    user_id: input.userId,
    organization_id: input.organizationId,
    entity_type: "client_interest_policy",
    entity_id: input.clientId,
    action: "update",
    new_data: data,
  });

  return data;
}

export function freezeClientInterest(input: PolicyActionInput) {
  return createFreezeEvent(input, "freeze");
}

export function resumeClientInterest(input: PolicyActionInput) {
  return createFreezeEvent(input, "resume");
}

export async function changeClientInterestRate(input: PolicyActionInput & { interestRateBps: number }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Reason is required");
  if (!Number.isInteger(input.interestRateBps) || input.interestRateBps < 0 || input.interestRateBps > 10000) {
    throw new Error("Invalid interest rate");
  }

  const effectiveDate = input.effectiveDate ?? getNextCloseDate();
  const { data: loans, error: loansError } = await (supabase as any)
    .from("loans")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("client_id", input.clientId)
    .is("voided_at", null)
    .lt("loan_date", effectiveDate);

  if (loansError) throw loansError;
  if (!loans?.length) throw new Error("No active loans");

  const rows = loans.map((loan: { id: string }) => ({
    user_id: input.userId,
    organization_id: input.organizationId,
    client_id: input.clientId,
    loan_id: loan.id,
    effective_date: effectiveDate,
    interest_rate_bps: input.interestRateBps,
    reason,
  }));
  const { data, error } = await (supabase as any).from("loan_interest_rate_changes").insert(rows).select("*");
  if (error) throw error;

  await (supabase as any).from("audit_logs").insert({
    user_id: input.userId,
    organization_id: input.organizationId,
    entity_type: "client_interest_policy",
    entity_id: input.clientId,
    action: "update",
    new_data: { effective_date: effectiveDate, interest_rate_bps: input.interestRateBps, reason, loan_ids: loans.map((loan: { id: string }) => loan.id) },
  });

  return data ?? [];
}

