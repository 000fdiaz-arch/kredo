import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/money";
import { listClientsWithBalances } from "@/services/clients.service";
import type { ClientStatus } from "@/types/domain";

type ClientFilter = "all" | ClientStatus;

const statusPriority: Record<ClientStatus, number> = {
  late: 0,
  interest_pending: 1,
  current: 2,
  no_movements: 3,
  inactive: 4,
};

const clientFilters: Array<{ id: ClientFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "late", label: "Atrasados" },
  { id: "interest_pending", label: "Interés pendiente" },
  { id: "current", label: "Al día" },
  { id: "no_movements", label: "Sin movimientos" },
  { id: "inactive", label: "Inactivos" },
];

export function ClientsPage() {
  const [activeFilter, setActiveFilter] = useState<ClientFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["clients"],
    queryFn: listClientsWithBalances,
  });

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const filteredClients = useMemo(() => {
    return clients
      .filter((client) => activeFilter === "all" || client.status === activeFilter)
      .filter((client) => {
        if (!normalizedSearch) return true;

        return [
          client.full_name,
          client.identification,
          client.phone,
          client.client_code,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      })
      .sort((first, second) => {
        const statusDifference = statusPriority[first.status] - statusPriority[second.status];
        if (statusDifference !== 0) return statusDifference;

        const firstBalance = first.balance?.total_balance_cents ?? 0;
        const secondBalance = second.balance?.total_balance_cents ?? 0;
        return secondBalance - firstBalance || first.full_name.localeCompare(second.full_name);
      });
  }, [activeFilter, clients, normalizedSearch]);

  return (
    <section>
      <PageHeader
        eyebrow="Clientes"
        title="Clientes"
      />

      <div className="mb-4 flex gap-2">
        <label className="flex min-h-12 flex-1 items-center gap-2 rounded-md border border-kredo-line bg-white px-3">
          <Search className="h-5 w-5 text-kredo-muted" aria-hidden="true" />
          <input
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Nombre, cédula o teléfono"
            type="search"
            value={searchTerm}
          />
        </label>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-md bg-kredo-primary px-4 text-white" to="/clients/new">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2" role="group" aria-label="Filtrar clientes por estado">
          {clientFilters.map((filter) => (
            <button
              aria-pressed={activeFilter === filter.id}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                activeFilter === filter.id
                  ? "border-kredo-primary bg-kredo-primary text-white"
                  : "border-kredo-line bg-white text-kredo-muted"
              }`}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando clientes...</article>
      ) : null}

      {error ? (
        <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">
          No se pudieron cargar los clientes. Refresca la pagina e intenta nuevamente.
        </article>
      ) : null}

      <div className="space-y-3">
        {filteredClients.map((client) => (
          <article className="rounded-lg border border-kredo-line bg-white p-4" key={client.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">{client.client_code}</p>
                <h2 className="mt-1 font-semibold text-kredo-ink">{client.full_name}</h2>
                <p className="mt-1 text-sm text-kredo-muted">{client.identification ?? "Cédula pendiente"} · {client.phone ?? "Teléfono pendiente"}</p>
              </div>
              <StatusBadge status={client.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-kredo-muted">Capital</p>
                <p className="font-semibold">{formatMoney(client.balance?.principal_balance_cents ?? 0)}</p>
              </div>
              <div>
                <p className="text-kredo-muted">Interés</p>
                <p className="font-semibold">{formatMoney(client.balance?.interest_balance_cents ?? 0)}</p>
              </div>
              <div>
                <p className="text-kredo-muted">Total</p>
                <p className="font-semibold">{formatMoney(client.balance?.total_balance_cents ?? 0)}</p>
              </div>
            </div>
            <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-kredo-line font-semibold" to={`/clients/${client.id}`}>
              Abrir perfil
            </Link>
          </article>
        ))}
      </div>

      {!isLoading && !error && clients.length === 0 ? (
        <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
          Aún no hay clientes registrados en esta empresa.
        </article>
      ) : null}

      {!isLoading && !error && clients.length > 0 && filteredClients.length === 0 ? (
        <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
          No hay clientes que coincidan con la búsqueda y el filtro seleccionado.
        </article>
      ) : null}
    </section>
  );
}
