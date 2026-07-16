import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/money";
import { getDashboardSummary } from "@/services/dashboard.service";

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  return (
    <section>
      <PageHeader
        eyebrow="Dashboard"
        title="Resumen de cartera"
        description="Saldos calculados desde Supabase."
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <MetricCard label="Capital prestado" value={formatMoney(data?.capitalLentCents ?? 0)} />
        <MetricCard label="Interes pendiente" value={formatMoney(data?.pendingInterestCents ?? 0)} tone="yellow" />
        <MetricCard label="Total cartera" value={formatMoney(data?.totalPortfolioCents ?? 0)} />
        <MetricCard label="Clientes activos" value={`${data?.activeClientCount ?? 0}`} helper={`${data?.lateClientCount ?? 0} con atraso`} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3">
        <MetricCard label="Pagos del ciclo" value={formatMoney(0)} helper="Capital recuperado e intereses cobrados" />
        <MetricCard label="Proximo cierre" value="Dia 15" helper="Luego ultimo dia del mes" />
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
          No se pudieron cargar los datos. Revisa que la migracion inicial este aplicada en Supabase.
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
