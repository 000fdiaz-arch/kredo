import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];

export type UpdateSettingsInput = Pick<
  UserSettings,
  "business_name" | "currency" | "default_interest_rate_bps" | "payment_application_rule" | "capitalize_interest"
>;

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from("user_settings")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (createError) throw createError;
  return created;
}

export async function updateUserSettings(userId: string, input: UpdateSettingsInput): Promise<UserSettings> {
  const businessName = input.business_name.trim();
  if (!businessName) throw new Error("El nombre del negocio es obligatorio.");
  if (!Number.isInteger(input.default_interest_rate_bps) || input.default_interest_rate_bps < 0) {
    throw new Error("La tasa de interes debe ser un numero positivo.");
  }

  const { data, error } = await supabase
    .from("user_settings")
    .update({ ...input, business_name: businessName })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
