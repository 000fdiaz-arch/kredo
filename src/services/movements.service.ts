import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type ClientMovementRow = Database["public"]["Views"]["client_movements"]["Row"];

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
