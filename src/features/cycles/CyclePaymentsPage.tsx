import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatMoney } from "@/lib/money";
import { getCurrentCyclePaymentBreakdown } from "@/services/cycle-payments.service";

const paymentMethodLabels = {
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  yappy: "Yappy",
  ach: "ACH",
  other: "Otro",
};

export function CyclePaymentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["cycle-payment-breakdown"],
    queryFn: getCurrentCyclePaymentBreakdown,
  });

  return (
    <section>
      <PageHeader
        eyebrow="Pagos"
        title="Pagos del ciclo"
        description={data ? `Ciclo ${data.startDate} al ${data.endDate}` : "Desglose de pagos del ciclo actual."}
      />

      <div className="mb-4 grid grid-cols-1 gap-3">
        <MetricCard label="Total recibido" value={formatMoney(data?.totalPaymentsCents ?? 0)} tone="green" />
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Capital" value={formatMoney(data?.principalRecoveredCents ?? 0)} />
          <MetricCard label="Interes" value={formatMoney(data?.interestCollectedCents ?? 0)} tone="yellow" />
        </div>
      </div>

      {isLoading ? (
        <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando pagos del ciclo...</article>
      ) : null}

      {error ? (
        <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">
          No se pudo cargar el desglose de pagos.
        </article>
      ) : null}

      <div className="space-y-3">
        {(data?.payments ?? []).map((payment) => (
          <article className="rounded-lg border border-kredo-line bg-white p-4" key={payment.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">{payment.payment_date}</p>
                <h2 className="mt-1 font-semibold text-kredo-ink">{payment.client_name}</h2>
                <p className="mt-1 text-sm text-kredo-muted">
                  {paymentMethodLabels[payment.payment_method]}
                  {payment.reference_number ? ` · Ref. ${payment.reference_number}` : ""}
                </p>
              </div>
              <p className="text-right text-lg font-bold">{formatMoney(payment.total_amount_cents)}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-kredo-muted">Capital</p>
                <p className="font-semibold">{formatMoney(payment.principal_amount_cents)}</p>
              </div>
              <div>
                <p className="text-kredo-muted">Interes</p>
                <p className="font-semibold">{formatMoney(payment.interest_amount_cents)}</p>
              </div>
            </div>

            {payment.notes ? <p className="mt-3 text-sm text-kredo-muted">{payment.notes}</p> : null}

            <Link
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-kredo-line font-semibold"
              to={`/clients/${payment.client_id}`}
            >
              Ver cliente
            </Link>
          </article>
        ))}
      </div>

      {!isLoading && !error && (data?.payments.length ?? 0) === 0 ? (
        <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
          No hay pagos registrados en este ciclo.
        </article>
      ) : null}
    </section>
  );
}
