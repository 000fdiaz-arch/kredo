import { supabase } from "@/lib/supabase";
import { getCycleRange } from "@/lib/dates";
import type { Database } from "@/types/database";

export type CycleRow = Database["public"]["Tables"]["cycles"]["Row"];

export async function getOrCreateCycle(userId: string, organizationId: string, dateValue: string): Promise<CycleRow> {
  const { startDate, endDate } = getCycleRange(dateValue);

  const { data: existing, error: lookupError } = await (supabase as any)
    .from("cycles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("start_date", startDate)
    .eq("end_date", endDate)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await (supabase as any)
    .from("cycles")
    .insert({
      user_id: userId,
      organization_id: organizationId,
      start_date: startDate,
      end_date: endDate,
      status: "open",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
