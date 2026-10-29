import { Link, useParams } from "react-router-dom";
import { Download, MessageCircle, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { getClientStatement } from "@/services/statements.service";
import { ClientStatementCard } from "@/features/statements/ClientStatementCard";
import { formatMoney } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { toWhatsAppPhone } from "@/lib/phone";

function getErrorDetail(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "AbortError") {
      return "El envio fue cancelado desde el menu de compartir.";
    }

    return `${error.name}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "El navegador no entrego un detalle tecnico.";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ClientStatementPage() {
  const { clientId = "" } = useParams();
  const statementRef = useRef<HTMLElement | null>(null);
  const preparedImageRef = useRef<{ blob: Blob; file: File; fileName: string } | null>(null);
  const [shareError, setShareError] = useState("");
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-statement", clientId],
    queryFn: () => getClientStatement(clientId),
    enabled: Boolean(clientId),
  });
  const clientName = data?.client?.full_name ?? "cliente";
  const imageFileName = `estado-${clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "cliente"}.png`;

  const createStatementImage = useCallback(async () => {
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
  }, []);

  const prepareStatementImage = useCallback(async () => {
    const blob = await createStatementImage();
    const file = new File([blob], imageFileName, { type: "image/png" });
    preparedImageRef.current = { blob, file, fileName: imageFileName };

    return preparedImageRef.current;
  }, [createStatementImage, imageFileName]);

  useEffect(() => {
    if (!data?.client) {
      return;
    }

    let cancelled = false;
    preparedImageRef.current = null;
    setShareError("");
    setIsPreparingImage(true);

    window.requestAnimationFrame(() => {
      prepareStatementImage()
        .catch(() => {
          if (!cancelled) {
            setShareError("No se pudo preparar la imagen. Usa el boton Imagen para generarla manualmente.");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsPreparingImage(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [data?.client, prepareStatementImage]);

  if (isLoading) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando estado de cuenta...</article>;
  }

  if (error || !data?.client) {
    return <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">No se pudo cargar el estado de cuenta.</article>;
  }

  const statementData = data;
  const client = statementData.client!;

  async function handleDownloadImage() {
    setShareError("");
    setIsPreparingImage(true);

    try {
      const image = preparedImageRef.current ?? (await prepareStatementImage());
      downloadBlob(image.blob, image.fileName);
    } catch (downloadError) {
      setShareError(`No se pudo generar o descargar la imagen. Motivo: ${getErrorDetail(downloadError)}`);
    } finally {
      setIsPreparingImage(false);
    }
  }

  function handleWhatsAppStatement() {
    setShareError("");
    const whatsAppPhone = toWhatsAppPhone(client.phone ?? "");
    if (whatsAppPhone.length < 10) {
      setShareError("El cliente no tiene un telefono valido para WhatsApp.");
      return;
    }

    const principal = formatMoney(client.balance?.principal_balance_cents ?? 0);
    const interest = formatMoney(client.balance?.interest_balance_cents ?? 0);
    const total = formatMoney(client.balance?.total_balance_cents ?? 0);
    const latestPayment = statementData.latestPayment;
    const messageLines = [
      `Hola ${client.full_name}, te comparto tu estado de cuenta de Kredo.`,
      "",
      `Capital pendiente: ${principal}`,
      `Interes pendiente: ${interest}`,
      `Total pendiente: ${total}`,
      latestPayment ? "" : null,
      latestPayment ? `Ultimo pago: ${formatMoney(latestPayment.total_amount_cents)}` : null,
      latestPayment ? `Fecha del ultimo pago: ${latestPayment.payment_date}` : null,
      "",
      `Actualizado al ${toDateInputValue()}.`,
    ].filter((line): line is string => line !== null);
    const whatsAppUrl = `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(messageLines.join("\n"))}`;
    const whatsAppWindow = window.open(whatsAppUrl, "_blank", "noopener,noreferrer");
    if (!whatsAppWindow) window.location.assign(whatsAppUrl);
  }

  return (
    <section>
      <div className="print:hidden">
        <PageHeader eyebrow="Estado" title="Estado de cuenta" description="Resumen para enviar al cliente." />
      </div>

      <ClientStatementCard data={data} ref={statementRef} />

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
          onClick={handleWhatsAppStatement}
          type="button"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          WhatsApp
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
