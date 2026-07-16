import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";

export function CyclesPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Ciclos"
        title="Ciclos quincenales"
        description="Preparado para cierre del dia 15 y ultimo dia de cada mes."
      />
      <div className="grid gap-3">
        <MetricCard label="Ciclo actual" value="Abierto" helper="La deteccion automatica se implementa en Fase 4." />
        <MetricCard label="Proximo cierre" value="Dia 15" />
      </div>
    </section>
  );
}
