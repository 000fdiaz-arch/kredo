import { PageHeader } from "@/components/ui/PageHeader";

export function HistoryPage() {
  return (
    <section>
      <PageHeader eyebrow="Historial" title="Movimientos" description="Consulta general de prestamos, pagos, intereses, ajustes y anulaciones." />
      <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
        El historial detallado ya esta disponible dentro del perfil de cada cliente.
      </article>
    </section>
  );
}
