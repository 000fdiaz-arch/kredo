import { listClientsWithBalances } from "@/services/clients.service";
import { getNextCloseDate, getCycleRange, toDateInputValue } from "@/lib/dates";
import { supabase } from "@/lib/supabase";

type CyclePaymentSummaryRow = {
  total_amount_cents: number;
  interest_amount_cents: number;
  principal_amount_cents: number;
};

async function getCurrentCyclePaymentSummary() {
  const today = toDateInputValue();
  const cycleRange = getCycleRange(today);
  const { data, error } = await supabase
    .from("payments")
    .select("total_amount_cents, interest_amount_cents, principal_amount_cents")
    .gte("payment_date", cycleRange.startDate)
    .lte("payment_date", cycleRange.endDate)
    .is("voided_at", null);

  if (error) {
    throw error;
  }

  const payments = (data ?? []) as CyclePaymentSummaryRow[];

  return {
    cycleRange,
    totalPaymentsCents: payments.reduce((total, payment) => total + payment.total_amount_cents, 0),
    interestCollectedCents: payments.reduce((total, payment) => total + payment.interest_amount_cents, 0),
    principalRecoveredCents: payments.reduce((total, payment) => total + payment.principal_amount_cents, 0),
  };
}

export async function getDashboardSummary() {
  const [clients, cyclePayments] = await Promise.all([
    listClientsWithBalances(),
    getCurrentCyclePaymentSummary(),
  ]);

  const activeClients = clients.filter((client) => client.status !== "inactive");
  const lateClients = clients.filter((client) => client.status === "late");

  return {
    clients,
    capitalLentCents: clients.reduce((total, client) => total + (client.balance?.principal_balance_cents ?? 0), 0),
    pendingInterestCents: clients.reduce((total, client) => total + (client.balance?.interest_balance_cents ?? 0), 0),
    totalPortfolioCents: clients.reduce((total, client) => total + (client.balance?.total_balance_cents ?? 0), 0),
    activeClientCount: activeClients.length,
    lateClientCount: lateClients.length,
    cyclePaymentStartDate: cyclePayments.cycleRange.startDate,
    cyclePaymentEndDate: cyclePayments.cycleRange.endDate,
    cyclePaymentsCents: cyclePayments.totalPaymentsCents,
    cycleInterestCollectedCents: cyclePayments.interestCollectedCents,
    cyclePrincipalRecoveredCents: cyclePayments.principalRecoveredCents,
    nextCloseDate: getNextCloseDate(),
  };
}
