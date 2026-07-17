import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatMoney } from "@/lib/money";
import { getCurrentCyclePaymentBreakdown } from "@/services/cycle-payments.service";

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
          <MetricCard label="Interes" value={formatMoney(data?.interestCollectedCents ?? 0)} tone="yellow" />
          <MetricCard label="Capital" value={formatMoney(data?.principalRecoveredCents ?? 0)} />
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

      <div className="space-y-2">
        {(data?.payments ?? []).map((payment) => (
          <Link className="block rounded-lg border border-kredo-line bg-white p-4" key={payment.id} to={`/clients/${payment.client_id}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-kredo-ink">{payment.client_name}</h2>
                <p className="mt-1 text-xs text-kredo-muted">{payment.payment_date}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-kredo-muted">Pago</p>
                <p className="text-lg font-bold text-kredo-ink">{formatMoney(payment.total_amount_cents)}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-kredo-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-kredo-muted">Interes</span>
                <span className="font-semibold">{formatMoney(payment.interest_amount_cents)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-kredo-muted">Capital</span>
                <span className="font-semibold">{formatMoney(payment.principal_amount_cents)}</span>
              </div>
            </div>
          </Link>
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
