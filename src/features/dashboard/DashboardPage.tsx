import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/money";
import { getDashboardSummary } from "@/services/dashboard.service";

function formatRatio(value: number) {
  return `${value.toFixed(2)}x`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  return (
    <section>
      <PageHeader
        eyebrow="Dashboard"
        title="Resumen financiero"
        description="Capital, caja, cartera y ganancia separados por naturaleza."
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <MetricCard
          label="Capital propio aportado"
          value={formatMoney(data?.capitalContributedCents ?? 0)}
          helper="Dinero nuevo colocado por el propietario."
        />
        <MetricCard
          label="Dinero actualmente prestado"
          value={formatMoney(data?.capitalLentCents ?? 0)}
          helper="Cartera activa: capital pendiente de cobrar."
        />
        <MetricCard
          label="Dinero disponible"
          value={formatMoney(data?.availableCashCents ?? 0)}
          helper="Caja no prestada, calculada desde movimientos."
          tone="green"
        />
        <MetricCard
          label="Intereses cobrados"
          value={formatMoney(data?.interestCollectedCents ?? 0)}
          helper="Ingresos financieros recibidos en efectivo."
          tone="yellow"
        />
        <MetricCard
          label="Ganancia neta"
          value={formatMoney(data?.netProfitCents ?? 0)}
          helper="Intereses y otros ingresos menos gastos y perdidas."
          tone={(data?.netProfitCents ?? 0) < 0 ? "red" : "green"}
        />
        <MetricCard
          label="Total desembolsado ciclo"
          value={formatMoney(data?.cycleLoanVolumeCents ?? 0)}
          helper="Volumen prestado, incluyendo dinero reutilizado."
        />
        <MetricCard
          label="Rotacion del capital"
          value={formatRatio(data?.cycleCapitalRotation ?? 0)}
          helper="Veces que el capital neto aportado roto en este ciclo."
        />
        <MetricCard
          label="Interes generado"
          value={formatMoney(data?.interestGeneratedCents ?? 0)}
          helper="Interes causado, aunque no se haya cobrado."
        />
        <MetricCard label="Interes pendiente" value={formatMoney(data?.pendingInterestCents ?? 0)} tone="yellow" />
        <MetricCard label="Total cartera" value={formatMoney(data?.totalPortfolioCents ?? 0)} />
        <MetricCard label="Clientes activos" value={`${data?.activeClientCount ?? 0}`} helper={`${data?.lateClientCount ?? 0} con atraso`} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3">
        <Link className="block" to="/cycles/payments">
          <MetricCard
            label="Pagos del ciclo"
            value={formatMoney(data?.cyclePaymentsCents ?? 0)}
            helper={
              data
                ? `Ciclo ${data.cyclePaymentStartDate} al ${data.cyclePaymentEndDate} - Capital ${formatMoney(data.cyclePrincipalRecoveredCents)} - Interes ${formatMoney(data.cycleInterestCollectedCents)} - Toca para revisar`
                : "Cargando ciclo actual"
            }
            tone="green"
          />
        </Link>
        <MetricCard
          label="Control historico"
          value={formatMoney(data?.historicalLoanVolumeCents ?? 0)}
          helper={`Prestamos ${data?.loanCount ?? 0} - Recuperacion ${formatPercent(data?.recoveryRate ?? 0)} - Retiros ${formatMoney(data?.capitalWithdrawnCents ?? 0)}`}
        />
        <MetricCard
          label="Proximo cierre"
          value={data?.nextCloseDate ?? "Cargando"}
          helper={data ? `Ciclo ${data.cyclePaymentStartDate} al ${data.cyclePaymentEndDate}` : "Cargando ciclo actual"}
        />
      </div>

      <div className="mb-4 flex gap-2">
        <label className="flex min-h-12 flex-1 items-center gap-2 rounded-md border border-kredo-line bg-white px-3">
          <Search className="h-5 w-5 text-kredo-muted" aria-hidden="true" />
          <input
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
            placeholder="Buscar cliente"
            type="search"
          />
        </label>
        <Link
          aria-label="Registrar pago"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-kredo-primary px-4 text-sm font-semibold text-white"
          to="/payments/new"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando datos desde Supabase...</article>
      ) : null}

      {error ? (
        <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">
          No se pudieron cargar los datos. Revisa que la migracion de movimientos financieros este aplicada en Supabase.
        </article>
      ) : null}

      <div className="space-y-3">
        {(data?.clients ?? []).map((client) => (
          <article className="rounded-lg border border-kredo-line bg-white p-4" key={client.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-kredo-ink">{client.full_name}</h2>
                <p className="mt-1 text-sm text-kredo-muted">Codigo: {client.client_code}</p>
              </div>
              <StatusBadge status={client.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-kredo-muted">Capital</p>
                <p className="font-semibold">{formatMoney(client.balance?.principal_balance_cents ?? 0)}</p>
              </div>
              <div>
                <p className="text-kredo-muted">Interes</p>
                <p className="font-semibold">{formatMoney(client.balance?.interest_balance_cents ?? 0)}</p>
              </div>
              <div>
                <p className="text-kredo-muted">Total</p>
                <p className="font-semibold">{formatMoney(client.balance?.total_balance_cents ?? 0)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-kredo-primary px-3 text-sm font-semibold text-white"
                to={`/loans/new?clientId=${client.id}`}
              >
                Prestamo
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-kredo-green px-3 text-sm font-semibold text-white"
                to={`/payments/new?clientId=${client.id}`}
              >
                Pago
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-kredo-line px-3 text-sm font-semibold"
                to={`/clients/${client.id}`}
              >
                Detalle
              </Link>
            </div>
          </article>
        ))}

        {!isLoading && !error && (data?.clients.length ?? 0) === 0 ? (
          <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
            Aun no hay clientes en Supabase.
          </article>
        ) : null}
      </div>
    </section>
  );
}
