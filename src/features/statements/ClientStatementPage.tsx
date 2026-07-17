import { Link, useParams } from "react-router-dom";
import { Download, Printer, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatMoney } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { getClientStatement } from "@/services/statements.service";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-kredo-line py-2 text-sm">
      <span className="text-kredo-muted">{label}</span>
      <span className="text-right font-semibold text-kredo-ink">{value}</span>
    </div>
  );
}

export function ClientStatementPage() {
  const { clientId = "" } = useParams();
  const statementRef = useRef<HTMLElement | null>(null);
  const [shareError, setShareError] = useState("");
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-statement", clientId],
    queryFn: () => getClientStatement(clientId),
    enabled: Boolean(clientId),
  });

  if (isLoading) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando estado de cuenta...</article>;
  }

  if (error || !data?.client) {
    return <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">No se pudo cargar el estado de cuenta.</article>;
  }

  const { client, latestPayment } = data;
  const principalBalanceCents = client.balance?.principal_balance_cents ?? 0;
  const interestBalanceCents = client.balance?.interest_balance_cents ?? 0;
  const totalBalanceCents = client.balance?.total_balance_cents ?? 0;
  const imageFileName = `estado-${client.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "cliente"}.png`;

  async function createStatementImage() {
    if (!statementRef.current) {
      throw new Error("Statement is not ready");
    }

    const canvas = await html2canvas(statementRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Image could not be created"));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  }

  async function handleDownloadImage() {
    setShareError("");
    setIsPreparingImage(true);

    try {
      const blob = await createStatementImage();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = imageFileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setShareError("No se pudo generar la imagen. Intenta otra vez.");
    } finally {
      setIsPreparingImage(false);
    }
  }

  async function handleShareImage() {
    setShareError("");
    setIsPreparingImage(true);

    try {
      const blob = await createStatementImage();
      const file = new File([blob], imageFileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Estado de cuenta",
          text: `Estado de cuenta de ${client.full_name}`,
          files: [file],
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = imageFileName;
      link.click();
      URL.revokeObjectURL(url);
      setShareError("Tu navegador no permite compartir directo. Descarga la imagen y enviala por WhatsApp.");
    } catch {
      setShareError("No se pudo compartir la imagen. Intenta descargarla.");
    } finally {
      setIsPreparingImage(false);
    }
  }

  return (
    <section>
      <div className="print:hidden">
        <PageHeader eyebrow="Estado" title="Estado de cuenta" description="Resumen para enviar al cliente." />
      </div>

      <article ref={statementRef} className="rounded-lg border border-kredo-line bg-white p-5 shadow-soft print:border-0 print:shadow-none">
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

      {shareError ? <p className="mt-4 rounded-md bg-yellow-50 px-3 py-2 text-sm font-medium text-kredo-yellow print:hidden">{shareError}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
        <Link className="min-h-12 rounded-md border border-kredo-line bg-white px-4 py-3 text-center font-semibold" to={`/clients/${client.id}`}>
          Ver cliente
        </Link>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white"
          onClick={() => window.print()}
          type="button"
        >
          <Printer className="h-5 w-5" aria-hidden="true" />
          Imprimir
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 print:hidden">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-kredo-green px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPreparingImage}
          onClick={handleShareImage}
          type="button"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
          Compartir
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-kredo-line bg-white px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPreparingImage}
          onClick={handleDownloadImage}
          type="button"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          Imagen
        </button>
      </div>
    </section>
  );
}
