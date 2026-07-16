import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";

export function ReportsPage() {
  return (
    <section>
      <PageHeader eyebrow="Reportes" title="Reportes basicos" description="Filtros preparados para exportacion CSV en Fase 5." />
      <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-4">
        <Field label="Fecha inicial" type="date" />
        <Field label="Fecha final" type="date" />
        <SelectField label="Estado">
          <option>Todos</option>
          <option>Al dia</option>
          <option>Interes pendiente</option>
          <option>Atrasado</option>
        </SelectField>
        <button className="min-h-12 w-full rounded-md border border-kredo-line bg-white px-4 py-3 font-semibold" type="button">
          Exportar CSV
        </button>
      </form>
    </section>
  );
}
