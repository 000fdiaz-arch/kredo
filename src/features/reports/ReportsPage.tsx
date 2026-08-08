import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { downloadCsv } from "@/lib/csv";
import { toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { movementTypeLabels, type MovementType } from "@/services/movements.service";
import { createMovementsCsv, createPortfolioCsv, filterReportData, getReportData } from "@/services/reports.service";
import type { ClientStatus } from "@/types/domain";

function firstDayOfMonth() {
  return `${toDateInputValue().slice(0, 7)}-01`;
}

export function ReportsPage() {
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(toDateInputValue);
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [movementType, setMovementType] = useState<MovementType | "all">("all");
  const [includeVoided, setIncludeVoided] = useState(false);
  const query = useQuery({ queryKey: ["report-data"], queryFn: getReportData });
  const dateError = startDate && endDate && startDate > endDate;
  const filtered = useMemo(() => {
    if (!query.data || dateError) return { clients: [], movements: [] };
    return filterReportData(query.data, { startDate, endDate, status, movementType, includeVoided });
  }, [dateError, endDate, includeVoided, movementType, query.data, startDate, status]);
  const movementTotal = filtered.movements.reduce((total, movement) => total + movement.amount_cents, 0);
  const portfolioTotal = filtered.clients.reduce((total, client) => total + (client.balance?.total_balance_cents ?? 0), 0);

  return (
    <section>
      <PageHeader eyebrow="Reportes" title="Reportes y exportacion" description="Filtra la cartera y descarga archivos compatibles con Excel." />
      <div className="space-y-4 rounded-lg border border-kredo-line bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha inicial" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          <Field label="Fecha final" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </div>
        <SelectField label="Estado del cliente" onChange={(event) => setStatus(event.target.value as ClientStatus | "all")} value={status}>
          <option value="all">Todos</option><option value="current">Al dia</option><option value="interest_pending">Interes pendiente</option><option value="late">Atrasado</option><option value="no_movements">Sin movimientos</option><option value="inactive">Inactivo</option>
        </SelectField>
        <SelectField label="Tipo de movimiento" onChange={(event) => setMovementType(event.target.value as MovementType | "all")} value={movementType}>
          <option value="all">Todos</option>
          {Object.entries(movementTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input checked={includeVoided} className="h-5 w-5" onChange={(event) => setIncludeVoided(event.target.checked)} type="checkbox" />Incluir anulados</label>
        {dateError ? <p className="rounded-md bg-red-50 p-3 text-sm text-kredo-red">La fecha inicial no puede ser posterior a la fecha final.</p> : null}
        {query.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-kredo-red">No se pudieron preparar los reportes.</p> : null}
        <div className="grid grid-cols-2 gap-3 rounded-md bg-kredo-surface p-3 text-sm">
          <div><p className="text-kredo-muted">Clientes</p><p className="font-bold">{filtered.clients.length}</p><p className="text-xs">{formatMoney(portfolioTotal)} pendiente</p></div>
          <div><p className="text-kredo-muted">Movimientos</p><p className="font-bold">{filtered.movements.length}</p><p className="text-xs">{formatMoney(movementTotal)} registrado</p></div>
        </div>
        <button className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={query.isLoading || Boolean(query.error) || Boolean(dateError)} onClick={() => downloadCsv(`kredo-movimientos-${startDate}-${endDate}.csv`, createMovementsCsv(filtered.movements))} type="button">Exportar movimientos CSV</button>
        <button className="min-h-12 w-full rounded-md border border-kredo-line bg-white px-4 py-3 font-semibold disabled:opacity-60" disabled={query.isLoading || Boolean(query.error)} onClick={() => downloadCsv(`kredo-cartera-${toDateInputValue()}.csv`, createPortfolioCsv(filtered.clients))} type="button">Exportar cartera CSV</button>
      </div>
    </section>
  );
}
