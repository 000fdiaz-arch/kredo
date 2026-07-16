import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { formatMoney } from "@/lib/money";
import { listClientsWithBalances } from "@/services/clients.service";

export function PaymentFormPage() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listClientsWithBalances,
  });

  return (
    <section>
      <PageHeader
        eyebrow="Registrar pago"
        title="Nuevo pago"
        description="El desglose mostrara interes primero y luego capital antes de guardar."
      />

      <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-4">
        <SelectField label="Cliente">
          <option value="">{isLoading ? "Cargando clientes..." : "Seleccionar cliente"}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.full_name}
            </option>
          ))}
        </SelectField>
        <Field label="Fecha" type="date" />
        <Field inputMode="decimal" label="Monto pagado" placeholder="0.00" type="number" />
        <SelectField label="Metodo de pago">
          <option>Efectivo</option>
          <option>Transferencia</option>
          <option>Yappy</option>
          <option>ACH</option>
          <option>Otro</option>
        </SelectField>
        <Field label="Numero de referencia" placeholder="Opcional" />
        <label className="block">
          <span className="text-sm font-medium text-kredo-ink">Observaciones</span>
          <textarea className="mt-2 min-h-24 w-full rounded-md border border-kredo-line bg-white px-3 py-3 text-base outline-none focus:border-kredo-primary" />
        </label>

        <div className="rounded-lg border border-kredo-line bg-kredo-surface p-4">
          <h2 className="font-semibold">Vista previa</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-kredo-muted">Aplicado a interes</dt>
              <dd className="font-semibold">{formatMoney(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-kredo-muted">Aplicado a capital</dt>
              <dd className="font-semibold">{formatMoney(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-kredo-muted">Saldo restante</dt>
              <dd className="font-semibold">{formatMoney(0)}</dd>
            </div>
          </dl>
        </div>

        <button className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white" type="button">
          Revisar pago
        </button>
      </form>
    </section>
  );
}
