import { forwardRef } from "react";
import { formatMoney } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { getClientStatement } from "@/services/statements.service";

type ClientStatementData = Awaited<ReturnType<typeof getClientStatement>>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-kredo-line py-2 text-sm">
      <span className="text-kredo-muted">{label}</span>
      <span className="text-right font-semibold text-kredo-ink">{value}</span>
    </div>
  );
}

export const ClientStatementCard = forwardRef<HTMLElement, { data: ClientStatementData; className?: string }>(
  function ClientStatementCard({ data, className = "" }, ref) {
    const { client, latestPayment } = data;
    const principalBalanceCents = client?.balance?.principal_balance_cents ?? 0;
    const interestBalanceCents = client?.balance?.interest_balance_cents ?? 0;
    const totalBalanceCents = client?.balance?.total_balance_cents ?? 0;

    if (!client) return null;

    return (
      <article ref={ref} className={`rounded-lg border border-kredo-line bg-white p-5 shadow-soft print:border-0 print:shadow-none ${className}`}>
        <header className="border-b border-kredo-line pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kredo-primary">Kredo</p>
          <h1 className="mt-2 text-2xl font-bold text-kredo-ink">Estado de cuenta</h1>
          <p className="mt-1 text-sm text-kredo-muted">Generado el {toDateInputValue()}</p>
        </header>

        <section className="mt-4">
          <h2 className="font-semibold text-kredo-ink">{client.full_name}</h2>
          <p className="mt-1 text-sm text-kredo-muted">
            {client.identification ? `Cedula ${client.identification}` : "Cedula pendiente"}
            {client.phone ? ` · Tel. ${client.phone}` : ""}
          </p>
        </section>

        <section className="mt-4 rounded-md bg-kredo-surface p-4">
          <p className="text-sm text-kredo-muted">Saldo actual</p>
          <p className="mt-1 text-3xl font-bold text-kredo-ink">{formatMoney(totalBalanceCents)}</p>
        </section>

        <section className="mt-4">
          <Row label="Capital pendiente" value={formatMoney(principalBalanceCents)} />
          <Row label="Interes pendiente" value={formatMoney(interestBalanceCents)} />
          <Row label="Total pendiente" value={formatMoney(totalBalanceCents)} />
        </section>

        <section className="mt-5">
          <h2 className="font-semibold text-kredo-ink">Ultimo pago</h2>
          {latestPayment ? (
            <div className="mt-2">
              <Row label="Fecha" value={latestPayment.payment_date} />
              <Row label="Monto pagado" value={formatMoney(latestPayment.total_amount_cents)} />
              <Row label="Aplicado a interes" value={formatMoney(latestPayment.interest_amount_cents)} />
              <Row label="Aplicado a capital" value={formatMoney(latestPayment.principal_amount_cents)} />
              <Row
                label="Ciclo"
                value={latestPayment.cycles ? `${latestPayment.cycles.start_date} al ${latestPayment.cycles.end_date}` : "Sin ciclo"}
              />
            </div>
          ) : (
            <p className="mt-2 rounded-md bg-kredo-surface p-3 text-sm text-kredo-muted">No hay pagos registrados.</p>
          )}
        </section>

        <p className="mt-5 text-center text-xs text-kredo-muted">Documento generado desde Kredo.</p>
      </article>
    );
  },
);
