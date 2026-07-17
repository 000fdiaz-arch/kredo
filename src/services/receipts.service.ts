import { supabase } from "@/lib/supabase";
import type { LoanRow } from "@/services/loans.service";
import type { PaymentRow } from "@/services/payments.service";

type ReceiptClient = {
  full_name: string;
  identification: string | null;
  phone: string | null;
};

type ReceiptCycle = {
  start_date: string;
  end_date: string;
};

export type LoanReceipt = LoanRow & {
  clients: ReceiptClient | null;
  cycles: ReceiptCycle | null;
};

export type PaymentReceipt = PaymentRow & {
  clients: ReceiptClient | null;
  cycles: ReceiptCycle | null;
};

export async function getLoanReceipt(loanId: string): Promise<LoanReceipt | null> {
  const { data, error } = await supabase
    .from("loans")
    .select("*, clients(full_name, identification, phone), cycles(start_date, end_date)")
    .eq("id", loanId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as LoanReceipt | null;
}

export async function getPaymentReceipt(paymentId: string): Promise<PaymentReceipt | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*, clients(full_name, identification, phone), cycles(start_date, end_date)")
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PaymentReceipt | null;
}
