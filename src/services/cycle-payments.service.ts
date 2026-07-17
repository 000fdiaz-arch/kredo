import { getCycleRange, toDateInputValue } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import type { PaymentRow } from "@/services/payments.service";

export type CyclePaymentDetail = PaymentRow & {
  client_name: string;
};

export type CyclePaymentBreakdown = {
  startDate: string;
  endDate: string;
  totalPaymentsCents: number;
  interestCollectedCents: number;
  principalRecoveredCents: number;
  payments: CyclePaymentDetail[];
};

type PaymentWithClientRow = PaymentRow & {
  clients?: {
    full_name: string;
  } | null;
};

export async function getCurrentCyclePaymentBreakdown(): Promise<CyclePaymentBreakdown> {
  const cycleRange = getCycleRange(toDateInputValue());
  const { data, error } = await supabase
    .from("payments")
    .select("*, clients(full_name)")
    .gte("payment_date", cycleRange.startDate)
    .lte("payment_date", cycleRange.endDate)
    .is("voided_at", null)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const payments = ((data ?? []) as PaymentWithClientRow[]).map((payment) => ({
    ...payment,
    client_name: payment.clients?.full_name ?? "Cliente sin nombre",
  }));

  return {
    startDate: cycleRange.startDate,
    endDate: cycleRange.endDate,
    totalPaymentsCents: payments.reduce((total, payment) => total + payment.total_amount_cents, 0),
    interestCollectedCents: payments.reduce((total, payment) => total + payment.interest_amount_cents, 0),
    principalRecoveredCents: payments.reduce((total, payment) => total + payment.principal_amount_cents, 0),
    payments,
  };
}
