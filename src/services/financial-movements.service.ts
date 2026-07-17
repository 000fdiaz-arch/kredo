import { getCycleRange, toDateInputValue } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { calculateFinancialSummary, type FinancialMovementInput, type FinancialMovementType } from "@/services/finance-ledger";

export type FinancialMovementRow = FinancialMovementInput & {
  id: string;
  user_id: string;
  movement_date: string;
  loan_id: string | null;
  payment_id: string | null;
  client_id: string | null;
  cycle_id: string | null;
  source: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  voided_at: string | null;
};

export type FinancialIndicators = ReturnType<typeof calculateFinancialSummary> & {
  currentCycleStartDate: string;
  currentCycleEndDate: string;
  cycleLoanVolumeCents: number;
  historicalLoanVolumeCents: number;
  cyclePrincipalRecoveredCents: number;
  interestGeneratedCents: number;
  retainedEquityCents: number;
  cycleCapitalRotation: number;
};

type InterestChargeAmountRow = {
  interest_amount_cents: number;
};

type LegacyLoanMovementRow = {
  id: string;
  user_id: string;
  client_id: string;
  cycle_id: string;
  loan_date: string;
  principal_amount_cents: number;
  created_at: string;
};

type LegacyPaymentMovementRow = {
  id: string;
  user_id: string;
  client_id: string;
  cycle_id: string;
  payment_date: string;
  principal_amount_cents: number;
  interest_amount_cents: number;
  created_at: string;
};

function asFinancialMovement(row: unknown): FinancialMovementRow {
  return row as FinancialMovementRow;
}

function cashDelta(movement: FinancialMovementRow) {
  if (["capital_contribution", "principal_recovery", "interest_income", "late_fee_income"].includes(movement.movement_type)) {
    return movement.amount_cents;
  }

  if (["loan_disbursement", "capital_withdrawal", "expense"].includes(movement.movement_type)) {
    return -movement.amount_cents;
  }

  return 0;
}

function sortMovements(movements: FinancialMovementRow[]) {
  return [...movements].sort((first, second) => (
    first.movement_date.localeCompare(second.movement_date) ||
    first.created_at.localeCompare(second.created_at) ||
    first.movement_type.localeCompare(second.movement_type)
  ));
}

function buildMovement(input: Partial<FinancialMovementRow> & Pick<FinancialMovementRow, "movement_date" | "movement_type" | "amount_cents" | "user_id">): FinancialMovementRow {
  return {
    id: input.id ?? `legacy-${input.movement_type}-${input.user_id}-${input.movement_date}-${input.amount_cents}`,
    user_id: input.user_id,
    movement_date: input.movement_date,
    movement_type: input.movement_type,
    amount_cents: input.amount_cents,
    loan_id: input.loan_id ?? null,
    payment_id: input.payment_id ?? null,
    client_id: input.client_id ?? null,
    cycle_id: input.cycle_id ?? null,
    source: input.source ?? "legacy_rebuild",
    description: input.description ?? null,
    created_at: input.created_at ?? `${input.movement_date}T00:00:00.000Z`,
    created_by: input.created_by ?? null,
    voided_at: null,
  };
}

function addEstimatedInitialContributions(movements: FinancialMovementRow[]) {
  const byUser = new Map<string, FinancialMovementRow[]>();

  for (const movement of movements) {
    byUser.set(movement.user_id, [...(byUser.get(movement.user_id) ?? []), movement]);
  }

  const contributions: FinancialMovementRow[] = [];

  for (const [userId, userMovements] of byUser) {
    const ordered = sortMovements(userMovements);
    let cash = 0;
    let minimumCash = 0;

    for (const movement of ordered) {
      cash += cashDelta(movement);
      minimumCash = Math.min(minimumCash, cash);
    }

    const amountCents = Math.max(-minimumCash, 0);

    if (amountCents > 0) {
      contributions.push(buildMovement({
        user_id: userId,
        movement_date: ordered[0]?.movement_date ?? toDateInputValue(),
        movement_type: "capital_contribution",
        amount_cents: amountCents,
        source: "legacy_estimate",
        description: "Aporte inicial estimado desde historial para evitar caja negativa.",
      }));
    }
  }

  return sortMovements([...contributions, ...movements]);
}

async function listLegacyFinancialMovements(): Promise<FinancialMovementRow[]> {
  const [{ data: loans, error: loansError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase
      .from("loans")
      .select("id, user_id, client_id, cycle_id, loan_date, principal_amount_cents, created_at")
      .is("voided_at", null),
    supabase
      .from("payments")
      .select("id, user_id, client_id, cycle_id, payment_date, principal_amount_cents, interest_amount_cents, created_at")
      .is("voided_at", null),
  ]);

  if (loansError) {
    throw loansError;
  }

  if (paymentsError) {
    throw paymentsError;
  }

  const loanMovements = ((loans ?? []) as LegacyLoanMovementRow[]).map((loan) => buildMovement({
    id: `legacy-loan-${loan.id}`,
    user_id: loan.user_id,
    movement_date: loan.loan_date,
    movement_type: "loan_disbursement",
    amount_cents: loan.principal_amount_cents,
    loan_id: loan.id,
    client_id: loan.client_id,
    cycle_id: loan.cycle_id,
    source: "legacy_rebuild",
    description: "Desembolso reconstruido desde prestamo.",
    created_at: loan.created_at,
  }));
  const paymentMovements = ((payments ?? []) as LegacyPaymentMovementRow[]).flatMap((payment) => [
    ...(payment.principal_amount_cents > 0
      ? [buildMovement({
          id: `legacy-payment-principal-${payment.id}`,
          user_id: payment.user_id,
          movement_date: payment.payment_date,
          movement_type: "principal_recovery" as const,
          amount_cents: payment.principal_amount_cents,
          payment_id: payment.id,
          client_id: payment.client_id,
          cycle_id: payment.cycle_id,
          source: "legacy_rebuild",
          description: "Capital recuperado reconstruido desde pago.",
          created_at: payment.created_at,
        })]
      : []),
    ...(payment.interest_amount_cents > 0
      ? [buildMovement({
          id: `legacy-payment-interest-${payment.id}`,
          user_id: payment.user_id,
          movement_date: payment.payment_date,
          movement_type: "interest_income" as const,
          amount_cents: payment.interest_amount_cents,
          payment_id: payment.id,
          client_id: payment.client_id,
          cycle_id: payment.cycle_id,
          source: "legacy_rebuild",
          description: "Interes cobrado reconstruido desde pago.",
          created_at: payment.created_at,
        })]
      : []),
  ]);

  return addEstimatedInitialContributions([...loanMovements, ...paymentMovements]);
}

export async function listFinancialMovements(): Promise<FinancialMovementRow[]> {
  const { data, error } = await (supabase as any)
    .from("financial_movements")
    .select("*")
    .is("voided_at", null)
    .order("movement_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return listLegacyFinancialMovements();
  }

  return (data ?? []).map(asFinancialMovement);
}

async function getInterestGeneratedCents() {
  const { data, error } = await supabase
    .from("interest_charges")
    .select("interest_amount_cents")
    .is("voided_at", null);

  if (error) {
    throw error;
  }

  return ((data ?? []) as InterestChargeAmountRow[]).reduce((total, charge) => total + charge.interest_amount_cents, 0);
}

export async function getFinancialIndicators(activePortfolioCents: number): Promise<FinancialIndicators> {
  const cycleRange = getCycleRange(toDateInputValue());
  const [movements, interestGeneratedCents] = await Promise.all([
    listFinancialMovements(),
    getInterestGeneratedCents(),
  ]);
  const summary = calculateFinancialSummary(movements);
  const cycleMovements = movements.filter(
    (movement) => movement.movement_date >= cycleRange.startDate && movement.movement_date <= cycleRange.endDate,
  );
  const cycleSummary = calculateFinancialSummary(cycleMovements);
  const retainedEquityCents = summary.availableCashCents + activePortfolioCents;
  const cycleCapitalRotation =
    summary.netContributedCapitalCents > 0 ? cycleSummary.loanVolumeCents / summary.netContributedCapitalCents : 0;

  return {
    ...summary,
    activePortfolioCents,
    currentCycleStartDate: cycleRange.startDate,
    currentCycleEndDate: cycleRange.endDate,
    cycleLoanVolumeCents: cycleSummary.loanVolumeCents,
    historicalLoanVolumeCents: summary.loanVolumeCents,
    cyclePrincipalRecoveredCents: cycleSummary.principalRecoveredCents,
    interestGeneratedCents,
    retainedEquityCents,
    cycleCapitalRotation,
  };
}

export async function getAvailableCashCents() {
  const movements = await listFinancialMovements();
  return calculateFinancialSummary(movements).availableCashCents;
}

export function getMovementTypeLabel(type: FinancialMovementType) {
  const labels: Record<FinancialMovementType, string> = {
    capital_contribution: "Aporte de capital",
    capital_withdrawal: "Retiro de capital",
    loan_disbursement: "Desembolso",
    principal_recovery: "Capital recuperado",
    interest_income: "Interes cobrado",
    late_fee_income: "Mora cobrada",
    expense: "Gasto",
    loan_loss: "Perdida incobrable",
    adjustment: "Ajuste",
  };

  return labels[type];
}
