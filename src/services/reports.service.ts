import { createCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/money";
import { listClientsWithBalances, type ClientWithBalance } from "@/services/clients.service";
import {
  listAllClientMovements,
  movementTypeLabels,
  type GeneralMovementRow,
  type MovementType,
} from "@/services/movements.service";
import type { ClientStatus } from "@/types/domain";

export type ReportFilters = {
  startDate: string;
  endDate: string;
  status: ClientStatus | "all";
  movementType: MovementType | "all";
  includeVoided: boolean;
};

export type ReportData = {
  clients: ClientWithBalance[];
  movements: GeneralMovementRow[];
};

const statusLabels: Record<ClientStatus, string> = {
  current: "Al dia",
  interest_pending: "Interes pendiente",
  late: "Atrasado",
  no_movements: "Sin movimientos",
  inactive: "Inactivo",
};

export function validateDateRange(startDate: string, endDate: string) {
  if (startDate && endDate && startDate > endDate) throw new Error("La fecha inicial no puede ser posterior a la fecha final.");
}

export function filterReportData(data: ReportData, filters: ReportFilters): ReportData {
  validateDateRange(filters.startDate, filters.endDate);
  const clients = filters.status === "all" ? data.clients : data.clients.filter((client) => client.status === filters.status);
  const allowedClientIds = new Set(clients.map((client) => client.id));
  const movements = data.movements.filter((movement) => (
    allowedClientIds.has(movement.client_id) &&
    (!filters.startDate || movement.movement_date >= filters.startDate) &&
    (!filters.endDate || movement.movement_date <= filters.endDate) &&
    (filters.movementType === "all" || movement.movement_type === filters.movementType) &&
    (filters.includeVoided || !movement.voided_at)
  ));
  return { clients, movements };
}

export async function getReportData(): Promise<ReportData> {
  const [clients, movements] = await Promise.all([listClientsWithBalances(), listAllClientMovements()]);
  return { clients, movements };
}

export function createPortfolioCsv(clients: ClientWithBalance[]) {
  return createCsv(
    ["Codigo", "Cliente", "Cedula", "Telefono", "Estado", "Capital pendiente", "Interes pendiente", "Total pendiente"],
    clients.map((client) => [
      client.client_code,
      client.full_name,
      client.identification,
      client.phone,
      statusLabels[client.status],
      formatMoney(client.balance?.principal_balance_cents ?? 0),
      formatMoney(client.balance?.interest_balance_cents ?? 0),
      formatMoney(client.balance?.total_balance_cents ?? 0),
    ]),
  );
}

export function createMovementsCsv(movements: GeneralMovementRow[]) {
  return createCsv(
    ["Fecha", "Codigo", "Cliente", "Tipo", "Monto", "Capital", "Interes", "Estado", "Notas"],
    movements.map((movement) => [
      movement.movement_date,
      movement.client_code,
      movement.client_name,
      movementTypeLabels[movement.movement_type],
      formatMoney(movement.amount_cents),
      formatMoney(movement.principal_amount_cents),
      formatMoney(movement.interest_amount_cents),
      movement.voided_at ? "Anulado" : "Activo",
      movement.notes,
    ]),
  );
}
