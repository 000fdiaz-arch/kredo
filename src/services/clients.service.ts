import { supabase } from "@/lib/supabase";
import { listDueCycleRanges, toDateInputValue } from "@/lib/dates";
import { calculateCycleInterest, type InterestLoan, type InterestPayment } from "@/services/interest.service";
import {
  isInterestFrozenAt,
  type InterestFreezeEvent,
  type InterestRateChange,
} from "@/services/interest-policy.service";
import type { Database } from "@/types/database";
import type { ClientStatus } from "@/types/domain";
import type { TagRow } from "@/services/tags.service";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientBalanceRow = Database["public"]["Views"]["client_balances"]["Row"];

export type ClientWithBalance = ClientRow & {
  balance: ClientBalanceRow | null;
  tags: TagRow[];
};

export type CreateClientInput = {
  userId: string;
  organizationId: string;
  fullName: string;
  identification?: string;
  phone?: string;
  address?: string;
  referenceName?: string;
  referencePhone?: string;
  notes?: string;
};

export type UpdateClientInput = CreateClientInput & {
  clientId: string;
};

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function createClientCode() {
  const now = new Date();
  const datePart = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");

  return `CLI-${datePart}-${timePart}`;
}

type InterestChargeStatusRow = Pick<
  Database["public"]["Tables"]["interest_charges"]["Row"],
  "client_id" | "cycle_id" | "interest_amount_cents"
>;

type CycleStatusRow = Pick<Database["public"]["Tables"]["cycles"]["Row"], "id" | "end_date">;

type PaymentInterestStatusRow = {
  client_id: string;
  payment_date: string;
  interest_amount_cents: number;
  principal_amount_cents: number;
  voided_at: string | null;
};

type ZeroInterestLoanStatusRow = Pick<Database["public"]["Tables"]["loans"]["Row"], "client_id">;
type LoanInterestStatusRow = Pick<
  Database["public"]["Tables"]["loans"]["Row"],
  "id" | "client_id" | "loan_date" | "principal_amount_cents" | "interest_rate_bps" | "created_at" | "voided_at"
>;
type ClientFreezeStatusRow = InterestFreezeEvent & { client_id: string };
type ClientRateStatusRow = InterestRateChange & { client_id: string };

function calculateDisplayStatus(client: ClientWithBalance, lateInterestCents: number, hasZeroInterestLoan: boolean): ClientStatus {
  if (client.status === "inactive") {
    return "inactive";
  }

  const principalBalanceCents = client.balance?.principal_balance_cents ?? 0;
  const interestBalanceCents = client.balance?.interest_balance_cents ?? 0;
  const totalBalanceCents = client.balance?.total_balance_cents ?? 0;

  if (lateInterestCents > 0) {
    return "late";
  }

  if (hasZeroInterestLoan && principalBalanceCents > 0) {
    return "late";
  }

  if (interestBalanceCents > 0) {
    return "interest_pending";
  }

  if (principalBalanceCents > 0 || totalBalanceCents > 0) {
    return "current";
  }

  return client.status === "no_movements" ? "no_movements" : "current";
}

async function getLateInterestByClient(clientIds: string[]) {
  if (clientIds.length === 0) {
    return new Map<string, number>();
  }

  const [
    { data: charges, error: chargesError },
    { data: payments, error: paymentsError },
    { data: loans, error: loansError },
    { data: freezeEvents, error: freezeEventsError },
    { data: rateChanges, error: rateChangesError },
  ] = await Promise.all([
    supabase
      .from("interest_charges")
      .select("client_id, cycle_id, interest_amount_cents")
      .in("client_id", clientIds)
      .is("voided_at", null),
    (supabase as any)
      .from("payments")
      .select("client_id, payment_date, interest_amount_cents, principal_amount_cents, voided_at")
      .in("client_id", clientIds)
      .is("voided_at", null),
    supabase
      .from("loans")
      .select("id, client_id, loan_date, principal_amount_cents, interest_rate_bps, created_at, voided_at")
      .in("client_id", clientIds)
      .is("voided_at", null)
      .order("loan_date", { ascending: true }),
    (supabase as any)
      .from("client_interest_freeze_events")
      .select("client_id, action, effective_date, reason, created_at")
      .in("client_id", clientIds),
    (supabase as any)
      .from("loan_interest_rate_changes")
      .select("client_id, loan_id, effective_date, interest_rate_bps, reason, created_at")
      .in("client_id", clientIds),
  ]);

  if (chargesError) {
    throw chargesError;
  }

  if (paymentsError) {
    throw paymentsError;
  }

  if (loansError) {
    throw loansError;
  }

  if (freezeEventsError) throw freezeEventsError;
  if (rateChangesError) throw rateChangesError;

  const interestCharges = (charges ?? []) as InterestChargeStatusRow[];
  const cycleIds = [...new Set(interestCharges.map((charge) => charge.cycle_id))];
  let cycles: CycleStatusRow[] = [];

  if (cycleIds.length > 0) {
    const { data, error } = await supabase
      .from("cycles")
      .select("id, end_date")
      .in("id", cycleIds);

    if (error) {
      throw error;
    }

    cycles = (data ?? []) as CycleStatusRow[];
  }

  const today = toDateInputValue();
  const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]));
  const generatedCycleEndDatesByClient = new Map<string, Set<string>>();
  const priorCycleInterestByClient = new Map<string, number>();
  const loansByClient = new Map<string, LoanInterestStatusRow[]>();
  const paymentsByClient = new Map<string, PaymentInterestStatusRow[]>();
  const paidInterestByClient = new Map<string, number>();
  const freezeEventsByClient = new Map<string, ClientFreezeStatusRow[]>();
  const rateChangesByClient = new Map<string, ClientRateStatusRow[]>();

  for (const event of (freezeEvents ?? []) as ClientFreezeStatusRow[]) {
    const clientEvents = freezeEventsByClient.get(event.client_id) ?? [];
    clientEvents.push(event);
    freezeEventsByClient.set(event.client_id, clientEvents);
  }

  for (const change of (rateChanges ?? []) as ClientRateStatusRow[]) {
    const clientChanges = rateChangesByClient.get(change.client_id) ?? [];
    clientChanges.push(change);
    rateChangesByClient.set(change.client_id, clientChanges);
  }

  for (const charge of interestCharges) {
    const cycle = cyclesById.get(charge.cycle_id);

    if (!cycle || cycle.end_date >= today) {
      continue;
    }

    priorCycleInterestByClient.set(
      charge.client_id,
      (priorCycleInterestByClient.get(charge.client_id) ?? 0) + charge.interest_amount_cents,
    );

    const generatedDates = generatedCycleEndDatesByClient.get(charge.client_id) ?? new Set<string>();
    generatedDates.add(cycle.end_date);
    generatedCycleEndDatesByClient.set(charge.client_id, generatedDates);
  }

  for (const payment of (payments ?? []) as PaymentInterestStatusRow[]) {
    const clientPayments = paymentsByClient.get(payment.client_id) ?? [];
    clientPayments.push(payment);
    paymentsByClient.set(payment.client_id, clientPayments);

    paidInterestByClient.set(
      payment.client_id,
      (paidInterestByClient.get(payment.client_id) ?? 0) + payment.interest_amount_cents,
    );
  }

  for (const loan of (loans ?? []) as LoanInterestStatusRow[]) {
    const clientLoans = loansByClient.get(loan.client_id) ?? [];
    clientLoans.push(loan);
    loansByClient.set(loan.client_id, clientLoans);
  }

  for (const clientId of clientIds) {
    const clientLoans = loansByClient.get(clientId) ?? [];
    const firstLoan = clientLoans[0];

    if (!firstLoan) {
      continue;
    }

    const generatedDates = generatedCycleEndDatesByClient.get(clientId) ?? new Set<string>();
    const clientPayments = paymentsByClient.get(clientId) ?? [];
    const clientFreezeEvents = freezeEventsByClient.get(clientId) ?? [];
    const clientRateChanges = rateChangesByClient.get(clientId) ?? [];
    const ungeneratedLateInterestCents = listDueCycleRanges(firstLoan.loan_date, today)
      .filter((range) => (
        range.endDate < today &&
        !generatedDates.has(range.endDate) &&
        !isInterestFrozenAt(clientFreezeEvents, range.endDate)
      ))
      .reduce((total, range) => {
        const interest = calculateCycleInterest(
          clientLoans as InterestLoan[],
          clientPayments as InterestPayment[],
          range.endDate,
          clientRateChanges,
        );

        return total + interest.interestAmountCents;
      }, 0);

    if (ungeneratedLateInterestCents > 0) {
      priorCycleInterestByClient.set(
        clientId,
        (priorCycleInterestByClient.get(clientId) ?? 0) + ungeneratedLateInterestCents,
      );
    }
  }

  return new Map(
    clientIds.map((clientId) => [
      clientId,
      Math.max((priorCycleInterestByClient.get(clientId) ?? 0) - (paidInterestByClient.get(clientId) ?? 0), 0),
    ]),
  );
}

async function getClientsWithZeroInterestLoans(clientIds: string[]) {
  if (clientIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("loans")
    .select("client_id")
    .in("client_id", clientIds)
    .eq("interest_rate_bps", 0)
    .is("voided_at", null);

  if (error) {
    throw error;
  }

  return new Set(((data ?? []) as ZeroInterestLoanStatusRow[]).map((loan) => loan.client_id));
}

async function applyDisplayStatuses<T extends ClientWithBalance>(clients: T[]): Promise<T[]> {
  const clientIds = clients.map((client) => client.id);
  const [lateInterestByClient, clientsWithZeroInterestLoans] = await Promise.all([
    getLateInterestByClient(clientIds),
    getClientsWithZeroInterestLoans(clientIds),
  ]);

  return clients.map((client) => ({
    ...client,
    status: calculateDisplayStatus(
      client,
      lateInterestByClient.get(client.id) ?? 0,
      clientsWithZeroInterestLoans.has(client.id),
    ),
  }));
}

export async function createClient(input: CreateClientInput): Promise<ClientRow> {
  const { data, error } = await (supabase as any)
    .from("clients")
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      client_code: createClientCode(),
      full_name: input.fullName.trim(),
      identification: normalizeOptional(input.identification),
      phone: normalizeOptional(input.phone),
      address: normalizeOptional(input.address),
      reference_name: normalizeOptional(input.referenceName),
      reference_phone: normalizeOptional(input.referencePhone),
      notes: normalizeOptional(input.notes),
      status: "no_movements",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateClient(input: UpdateClientInput): Promise<ClientRow> {
  const { data, error } = await (supabase as any)
    .from("clients")
    .update({
      full_name: input.fullName.trim(),
      identification: normalizeOptional(input.identification),
      phone: normalizeOptional(input.phone),
      address: normalizeOptional(input.address),
      reference_name: normalizeOptional(input.referenceName),
      reference_phone: normalizeOptional(input.referencePhone),
      notes: normalizeOptional(input.notes),
    })
    .eq("id", input.clientId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listClientsWithBalances(): Promise<ClientWithBalance[]> {
  const [
    { data: clients, error: clientsError },
    { data: balances, error: balancesError },
    { data: tags, error: tagsError },
    { data: clientTags, error: clientTagsError },
  ] = await Promise.all([
    supabase.from("clients").select("*").order("full_name", { ascending: true }),
    supabase.from("client_balances").select("*"),
    supabase.from("tags").select("*"),
    supabase.from("client_tags").select("client_id, tag_id"),
  ]);

  if (clientsError) {
    throw clientsError;
  }

  if (balancesError) {
    throw balancesError;
  }

  if (tagsError) throw tagsError;
  if (clientTagsError) throw clientTagsError;

  const balancesByClient = new Map((balances ?? []).map((balance) => [balance.client_id, balance]));
  const tagsById = new Map((tags ?? []).map((tag) => [tag.id, tag]));
  const tagsByClient = new Map<string, TagRow[]>();

  for (const assignment of clientTags ?? []) {
    const tag = tagsById.get(assignment.tag_id);
    if (!tag) continue;
    const assignedTags = tagsByClient.get(assignment.client_id) ?? [];
    assignedTags.push(tag);
    tagsByClient.set(assignment.client_id, assignedTags);
  }

  return applyDisplayStatuses((clients ?? []).map((client) => ({
    ...client,
    balance: balancesByClient.get(client.id) ?? null,
    tags: (tagsByClient.get(client.id) ?? []).sort((first, second) => first.name.localeCompare(second.name)),
  })));
}

export async function getClientWithBalance(clientId: string): Promise<ClientWithBalance | null> {
  const [
    { data: client, error: clientError },
    { data: balance, error: balanceError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    supabase.from("client_balances").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("client_tags").select("tag_id").eq("client_id", clientId),
  ]);

  if (clientError) {
    throw clientError;
  }

  if (balanceError) {
    throw balanceError;
  }

  if (assignmentsError) throw assignmentsError;

  if (!client) {
    return null;
  }

  const tagIds = (assignments ?? []).map((assignment) => assignment.tag_id);
  let tags: TagRow[] = [];
  if (tagIds.length > 0) {
    const { data: tagRows, error: tagsError } = await supabase.from("tags").select("*").in("id", tagIds);
    if (tagsError) throw tagsError;
    tags = (tagRows ?? []).sort((first, second) => first.name.localeCompare(second.name));
  }

  const [clientWithStatus] = await applyDisplayStatuses([{
    ...client,
    balance,
    tags,
  }]);

  return clientWithStatus;
}
