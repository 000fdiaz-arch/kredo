import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { formatMoney } from "@/lib/money";
import { listAllClientMovements, movementTypeLabels, type MovementType } from "@/services/movements.service";

export function HistoryPage() {
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState<MovementType | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeVoided, setIncludeVoided] = useState(false);
  const query = useQuery({ queryKey: ["all-client-movements"], queryFn: listAllClientMovements });

  const visibleMovements = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter((movement) => (
      (!term || movement.client_name.toLowerCase().includes(term) || movement.client_code.toLowerCase().includes(term)) &&
      (movementType === "all" || movement.movement_type === movementType) &&
      (!startDate || movement.movement_date >= startDate) &&
      (!endDate || movement.movement_date <= endDate) &&
      (includeVoided || !movement.voided_at)
    ));
  }, [endDate, includeVoided, movementType, query.data, search, startDate]);

  return (
    <section>
      <PageHeader eyebrow="Historial" title="Todos los movimientos" description="Prestamos, pagos, intereses, ajustes, notas y anulaciones en una sola vista." />
      <div className="mb-4 space-y-3 rounded-lg border border-kredo-line bg-white p-4">
        <Field label="Buscar cliente" onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o codigo" type="search" value={search} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          <Field label="Hasta" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </div>
        <SelectField label="Tipo de movimiento" onChange={(event) => setMovementType(event.target.value as MovementType | "all")} value={movementType}>
          <option value="all">Todos</option>
          {Object.entries(movementTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input checked={includeVoided} className="h-5 w-5" onChange={(event) => setIncludeVoided(event.target.checked)} type="checkbox" />
          Mostrar movimientos anulados
        </label>
      </div>

      {startDate && endDate && startDate > endDate ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-kredo-red">La fecha inicial no puede ser posterior a la fecha final.</p> : null}
      {query.isLoading ? <p className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando historial...</p> : null}
      {query.error ? <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-kredo-red">No se pudo cargar el historial.</p> : null}

      <div className="space-y-3">
        {visibleMovements.map((movement) => (
          <article className={`rounded-lg border bg-white p-4 ${movement.voided_at ? "border-red-200 opacity-70" : "border-kredo-line"}`} key={`${movement.movement_type}-${movement.movement_id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{movementTypeLabels[movement.movement_type]}</p>
                <Link className="mt-1 block text-sm text-kredo-primary underline" to={`/clients/${movement.client_id}`}>{movement.client_name} · {movement.client_code}</Link>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatMoney(movement.amount_cents)}</p>
                <p className="text-xs text-kredo-muted">{movement.movement_date}</p>
              </div>
            </div>
            {(movement.principal_amount_cents || movement.interest_amount_cents) ? (
              <p className="mt-3 text-sm text-kredo-muted">Capital {formatMoney(movement.principal_amount_cents)} · Interes {formatMoney(movement.interest_amount_cents)}</p>
            ) : null}
            {movement.notes ? <p className="mt-2 text-sm">{movement.notes}</p> : null}
            {movement.voided_at ? <p className="mt-2 text-xs font-semibold text-kredo-red">ANULADO</p> : null}
          </article>
        ))}
      </div>
      {!query.isLoading && !query.error && visibleMovements.length === 0 ? <p className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">No hay movimientos que coincidan con los filtros.</p> : null}
    </section>
  );
}
