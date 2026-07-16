import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/money";
import { listClientsWithBalances } from "@/services/clients.service";

export function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["clients"],
    queryFn: listClientsWithBalances,
  });

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const filteredClients = useMemo(() => {
    if (!normalizedSearch) {
      return clients;
    }

    return clients.filter((client) =>
      [
        client.full_name,
        client.identification,
        client.phone,
        client.client_code,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch)),
    );
  }, [clients, normalizedSearch]);

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
            placeholder="Nombre, cedula o telefono"
            type="search"
            value={searchTerm}
          />
        </label>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-md bg-kredo-primary px-4 text-white" to="/clients/new">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando clientes desde Supabase...</article>
      ) : null}

      {error ? (
        <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">
          No se pudieron cargar los clientes. Revisa que la migracion inicial este aplicada en Supabase.
        </article>
      ) : null}

      <div className="space-y-3">
        {filteredClients.map((client) => (
          <article className="rounded-lg border border-kredo-line bg-white p-4" key={client.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">{client.client_code}</p>
                <h2 className="mt-1 font-semibold text-kredo-ink">{client.full_name}</h2>
                <p className="mt-1 text-sm text-kredo-muted">{client.identification ?? "Cedula pendiente"} · {client.phone ?? "Telefono pendiente"}</p>
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
            <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-kredo-line font-semibold" to={`/clients/${client.id}`}>
              Abrir perfil
            </Link>
          </article>
        ))}
      </div>

      {!isLoading && !error && clients.length === 0 ? (
        <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
          Aun no hay clientes en Supabase.
        </article>
      ) : null}

      {!isLoading && !error && clients.length > 0 && filteredClients.length === 0 ? (
        <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
          No hay clientes que coincidan con la busqueda.
        </article>
      ) : null}
    </section>
  );
}
