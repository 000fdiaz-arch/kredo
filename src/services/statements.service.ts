import { getClientWithBalance } from "@/services/clients.service";
import { supabase } from "@/lib/supabase";
import type { PaymentRow } from "@/services/payments.service";

export type ClientStatementPayment = PaymentRow & {
  cycles: {
    start_date: string;
    end_date: string;
  } | null;
};

export async function getClientStatement(clientId: string) {
  const [client, latestPaymentResult] = await Promise.all([
    getClientWithBalance(clientId),
    supabase
      .from("payments")
      .select("*, cycles(start_date, end_date)")
      .eq("client_id", clientId)
      .is("voided_at", null)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (latestPaymentResult.error) {
    throw latestPaymentResult.error;
  }

  return {
    client,
    latestPayment: latestPaymentResult.data as ClientStatementPayment | null,
  };
}
