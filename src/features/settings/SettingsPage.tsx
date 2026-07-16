import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";

export function SettingsPage() {
  return (
    <section>
      <PageHeader eyebrow="Configuracion" title="Configuracion" description="Valores por usuario para reglas y preferencias de Kredo." />
      <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-4">
        <Field label="Nombre del negocio" defaultValue="Kredo" />
        <SelectField label="Moneda" defaultValue="USD">
          <option value="USD">USD</option>
        </SelectField>
        <Field inputMode="decimal" label="Interes predeterminado (%)" defaultValue="10" type="number" />
        <SelectField label="Regla de pagos" defaultValue="interest_first">
          <option value="interest_first">Interes primero, capital despues</option>
        </SelectField>
        <SelectField label="Capitalizacion de intereses" defaultValue="false">
          <option value="false">Desactivada</option>
          <option value="true">Activada</option>
        </SelectField>
        <button className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white" type="button">
          Guardar configuracion
        </button>
      </form>
    </section>
  );
}
