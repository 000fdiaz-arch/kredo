import { listClientsWithBalances } from "@/services/clients.service";
import { getNextCloseDate } from "@/lib/dates";
import { getCurrentCyclePaymentBreakdown } from "@/services/cycle-payments.service";
import { getFinancialIndicators } from "@/services/financial-movements.service";
import type { ClientWithBalance } from "@/services/clients.service";

const statusPriority = {
  late: 0,
  interest_pending: 1,
  current: 2,
  no_movements: 3,
  inactive: 4,
};

function getClientUrgencyAmount(client: ClientWithBalance) {
  return client.balance?.total_balance_cents ?? 0;
}

function sortClientsByUrgency(clients: ClientWithBalance[]) {
  return [...clients].sort((first, second) => {
    const firstTotal = getClientUrgencyAmount(first);
    const secondTotal = getClientUrgencyAmount(second);

    if (firstTotal <= 0 && secondTotal > 0) {
      return 1;
    }

    if (firstTotal > 0 && secondTotal <= 0) {
      return -1;
    }

    const statusDifference = statusPriority[first.status] - statusPriority[second.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return secondTotal - firstTotal || first.full_name.localeCompare(second.full_name);
  });
}

export async function getDashboardSummary() {
  const [clients, cyclePayments] = await Promise.all([
    listClientsWithBalances(),
    getCurrentCyclePaymentBreakdown(),
  ]);

  const activeClients = clients.filter((client) => client.status !== "inactive");
  const lateClients = clients.filter((client) => client.status === "late");
  const activePortfolioCents = clients.reduce((total, client) => total + (client.balance?.principal_balance_cents ?? 0), 0);
  const pendingInterestCents = clients.reduce((total, client) => total + (client.balance?.interest_balance_cents ?? 0), 0);
  const totalPortfolioCents = clients.reduce((total, client) => total + (client.balance?.total_balance_cents ?? 0), 0);
  const financial = await getFinancialIndicators(activePortfolioCents);

  return {
    clients: sortClientsByUrgency(clients),
    capitalLentCents: activePortfolioCents,
    pendingInterestCents,
    totalPortfolioCents,
    activeClientCount: activeClients.length,
    lateClientCount: lateClients.length,
    capitalContributedCents: financial.capitalContributedCents,
    capitalWithdrawnCents: financial.capitalWithdrawnCents,
    netContributedCapitalCents: financial.netContributedCapitalCents,
    availableCashCents: financial.availableCashCents,
    interestGeneratedCents: financial.interestGeneratedCents,
    interestCollectedCents: financial.interestCollectedCents,
    netProfitCents: financial.netProfitCents,
    retainedEquityCents: financial.retainedEquityCents,
    cycleLoanVolumeCents: financial.cycleLoanVolumeCents,
    historicalLoanVolumeCents: financial.historicalLoanVolumeCents,
    cyclePrincipalRecoveredCents: financial.cyclePrincipalRecoveredCents,
    loanCount: financial.loanCount,
    paidLoanCount: financial.paidLoanCount,
    recoveryRate: financial.recoveryRate,
    capitalRotation: financial.capitalRotation,
    cycleCapitalRotation: financial.cycleCapitalRotation,
    cyclePaymentStartDate: cyclePayments.startDate,
    cyclePaymentEndDate: cyclePayments.endDate,
    cyclePaymentsCents: cyclePayments.totalPaymentsCents,
    cycleInterestCollectedCents: cyclePayments.interestCollectedCents,
    nextCloseDate: getNextCloseDate(),
  };
}
