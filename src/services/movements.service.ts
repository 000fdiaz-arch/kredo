import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { ClientRow } from "@/services/clients.service";

export type ClientMovementRow = Database["public"]["Views"]["client_movements"]["Row"];
export type MovementType = ClientMovementRow["movement_type"];
export type GeneralMovementRow = ClientMovementRow & {
  client_name: string;
  client_code: string;
};

export const movementTypeLabels: Record<MovementType, string> = {
  loan: "Prestamo",
  payment: "Pago",
  interest_charge: "Interes generado",
  adjustment: "Ajuste",
  note: "Nota",
};

export async function listClientMovements(clientId: string): Promise<ClientMovementRow[]> {
  const { data, error } = await supabase
    .from("client_movements")
    .select("*")
    .eq("client_id", clientId)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listAllClientMovements(): Promise<GeneralMovementRow[]> {
  const [{ data: movements, error: movementsError }, { data: clients, error: clientsError }] = await Promise.all([
    supabase
      .from("client_movements")
      .select("*")
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, full_name, client_code"),
  ]);

  if (movementsError) throw movementsError;
  if (clientsError) throw clientsError;

  const clientsById = new Map(
    ((clients ?? []) as Pick<ClientRow, "id" | "full_name" | "client_code">[]).map((client) => [client.id, client]),
  );

  return (movements ?? []).map((movement) => ({
    ...movement,
    client_name: clientsById.get(movement.client_id)?.full_name ?? "Cliente eliminado",
    client_code: clientsById.get(movement.client_id)?.client_code ?? "-",
  }));
}
