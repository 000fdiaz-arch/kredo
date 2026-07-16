import { listClientsWithBalances } from "@/services/clients.service";

export async function getDashboardSummary() {
  const clients = await listClientsWithBalances();

  const activeClients = clients.filter((client) => client.status !== "inactive");
  const lateClients = clients.filter((client) => client.status === "late");

  return {
    clients,
    capitalLentCents: clients.reduce((total, client) => total + (client.balance?.principal_balance_cents ?? 0), 0),
    pendingInterestCents: clients.reduce((total, client) => total + (client.balance?.interest_balance_cents ?? 0), 0),
    totalPortfolioCents: clients.reduce((total, client) => total + (client.balance?.total_balance_cents ?? 0), 0),
    activeClientCount: activeClients.length,
    lateClientCount: lateClients.length,
  };
}
