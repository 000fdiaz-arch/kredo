import { supabase } from "@/lib/supabase";
import { getOrCreateCycle } from "@/services/cycles.service";
import type { Database } from "@/types/database";

export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type PaymentMethod = PaymentRow["payment_method"];

export type CreatePaymentInput = {
  userId: string;
  clientId: string;
  paymentDate: string;
  totalAmountCents: number;
  interestAmountCents: number;
  principalAmountCents: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  overpaymentConfirmed: boolean;
};

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentRow> {
  const cycle = await getOrCreateCycle(input.userId, input.paymentDate);

  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: input.userId,
      client_id: input.clientId,
      cycle_id: cycle.id,
      payment_date: input.paymentDate,
      total_amount_cents: input.totalAmountCents,
      interest_amount_cents: input.interestAmountCents,
      principal_amount_cents: input.principalAmountCents,
      payment_method: input.paymentMethod,
      reference_number: normalizeOptional(input.referenceNumber),
      notes: normalizeOptional(input.notes),
      overpayment_confirmed: input.overpaymentConfirmed,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await supabase.from("audit_logs").insert({
    user_id: input.userId,
    entity_type: "payment",
    entity_id: data.id,
    action: "create",
    new_data: data,
  });

  return data;
}
