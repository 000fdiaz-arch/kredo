import { Link, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatMoney } from "@/lib/money";
import { getLoanReceipt, getPaymentReceipt, type LoanReceipt, type PaymentReceipt } from "@/services/receipts.service";

const paymentMethodLabels = {
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  yappy: "Yappy",
  ach: "ACH",
  other: "Otro",
};

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

type ReceiptData = LoanReceipt | PaymentReceipt;

function isPaymentReceipt(receipt: ReceiptData): receipt is PaymentReceipt {
  return "payment_date" in receipt;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-kredo-line py-2 text-sm">
      <span className="text-kredo-muted">{label}</span>
      <span className="text-right font-semibold text-kredo-ink">{value}</span>
    </div>
  );
}

export function ReceiptPage() {
  const { receiptType = "", receiptId = "" } = useParams();
  const isPayment = receiptType === "payment";

  const { data, isLoading, error } = useQuery<ReceiptData | null>({
    queryKey: ["receipt", receiptType, receiptId],
    queryFn: () => (isPayment ? getPaymentReceipt(receiptId) : getLoanReceipt(receiptId)),
    enabled: Boolean(receiptId) && (receiptType === "payment" || receiptType === "loan"),
  });

  if (isLoading) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando recibo...</article>;
  }

  if (error || !data) {
    return <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">No se pudo cargar el recibo.</article>;
  }

  const client = data.clients;
  const cycle = data.cycles;
  const title = isPayment ? "Recibo de pago" : "Recibo de prestamo";
  const receiptNumber = `${isPayment ? "PAG" : "PRE"}-${shortId(data.id)}`;
  const date = isPaymentReceipt(data) ? data.payment_date : data.loan_date;
  const totalAmount = isPaymentReceipt(data) ? data.total_amount_cents : data.principal_amount_cents;

  return (
    <section>
      <div className="print:hidden">
        <PageHeader eyebrow="Recibo" title={title} description="Puedes imprimirlo o guardarlo como PDF desde el navegador." />
      </div>

      <article className="rounded-lg border border-kredo-line bg-white p-5 shadow-soft print:border-0 print:shadow-none">
        <header className="border-b border-kredo-line pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kredo-primary">Kredo</p>
              <h1 className="mt-2 text-2xl font-bold text-kredo-ink">{title}</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-kredo-muted">Recibo</p>
              <p className="font-bold text-kredo-ink">{receiptNumber}</p>
            </div>
          </div>
        </header>

        <section className="mt-4">
          <h2 className="font-semibold text-kredo-ink">{client?.full_name ?? "Cliente"}</h2>
          <p className="mt-1 text-sm text-kredo-muted">
            {client?.identification ? `Cedula ${client.identification}` : "Cedula pendiente"}
            {client?.phone ? ` · Tel. ${client.phone}` : ""}
          </p>
        </section>

        <section className="mt-4 rounded-md bg-kredo-surface p-4">
          <p className="text-sm text-kredo-muted">Monto</p>
          <p className="mt-1 text-3xl font-bold text-kredo-ink">{formatMoney(totalAmount)}</p>
        </section>

        <section className="mt-4">
          <Row label="Fecha" value={date} />
          <Row label="Ciclo" value={cycle ? `${cycle.start_date} al ${cycle.end_date}` : "Sin ciclo"} />

          {isPaymentReceipt(data) ? (
            <>
              <Row label="Aplicado a interes" value={formatMoney(data.interest_amount_cents)} />
              <Row label="Aplicado a capital" value={formatMoney(data.principal_amount_cents)} />
              <Row label="Metodo" value={paymentMethodLabels[data.payment_method]} />
              {data.reference_number ? <Row label="Referencia" value={data.reference_number} /> : null}
            </>
          ) : (
            <>
              <Row label="Capital entregado" value={formatMoney(data.principal_amount_cents)} />
              <Row label="Interes pactado" value={`${(data.interest_rate_bps / 100).toFixed(2)}%`} />
            </>
          )}
        </section>

        {data.notes ? (
          <section className="mt-4 rounded-md border border-kredo-line p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">Notas</p>
            <p className="mt-1 text-sm text-kredo-ink">{data.notes}</p>
          </section>
        ) : null}

        <p className="mt-5 text-center text-xs text-kredo-muted">Documento generado desde Kredo.</p>
      </article>

      <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
        <Link className="min-h-12 rounded-md border border-kredo-line bg-white px-4 py-3 text-center font-semibold" to={`/clients/${data.client_id}`}>
          Ver cliente
        </Link>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white"
          onClick={() => window.print()}
          type="button"
        >
          <Printer className="h-5 w-5" aria-hidden="true" />
          Imprimir
        </button>
      </div>
    </section>
  );
}
