import { supabase } from "@/lib/supabase";
import { getOrCreateCycle } from "@/services/cycles.service";
import type { Database } from "@/types/database";

export type LoanRow = Database["public"]["Tables"]["loans"]["Row"];

export type CreateLoanInput = {
  userId: string;
  clientId: string;
  loanDate: string;
  amountCents: number;
  interestRateBps: number;
  notes?: string;
};

export type VoidLoanInput = {
  loanId: string;
  userId: string;
  reason: string;
};

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createLoan(input: CreateLoanInput): Promise<LoanRow> {
  const cycle = await getOrCreateCycle(input.userId, input.loanDate);

  const { data, error } = await supabase
    .from("loans")
    .insert({
      user_id: input.userId,
      client_id: input.clientId,
      cycle_id: cycle.id,
      loan_date: input.loanDate,
      principal_amount_cents: input.amountCents,
      interest_rate_bps: input.interestRateBps,
      notes: normalizeOptional(input.notes),
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function voidLoan(input: VoidLoanInput): Promise<LoanRow> {
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("Void reason is required");
  }

  const { data: existing, error: lookupError } = await supabase
    .from("loans")
    .select("*")
    .eq("id", input.loanId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!existing) {
    throw new Error("Loan not found");
  }

  if (existing.voided_at) {
    return existing;
  }

  const { data, error } = await supabase
    .from("loans")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: input.userId,
      void_reason: reason,
    })
    .eq("id", input.loanId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await supabase.from("audit_logs").insert({
    user_id: input.userId,
    entity_type: "loan",
    entity_id: input.loanId,
    action: "void",
    previous_data: existing,
    new_data: data,
  });

  return data;
}
