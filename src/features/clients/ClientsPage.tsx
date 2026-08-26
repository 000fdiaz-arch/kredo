import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus, Search, Share2, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { listClientsWithBalances, type ClientWithBalance } from "@/services/clients.service";
import { listTags } from "@/services/tags.service";
import { useOrganization } from "@/features/organizations/OrganizationProvider";
import type { ClientStatus } from "@/types/domain";

type ClientFilter = "all" | ClientStatus;

const statusPriority: Record<ClientStatus, number> = {
  late: 0,
  interest_pending: 1,
  current: 2,
  no_movements: 3,
  inactive: 4,
};

const statusLabels: Record<ClientStatus, string> = {
  late: "Atrasado",
  interest_pending: "Interés pendiente",
  current: "Al día",
  no_movements: "Sin movimientos",
  inactive: "Inactivo",
};

const clientFilters: Array<{ id: ClientFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "late", label: "Atrasados" },
  { id: "interest_pending", label: "Interés pendiente" },
  { id: "current", label: "Al día" },
  { id: "no_movements", label: "Sin movimientos" },
  { id: "inactive", label: "Inactivos" },
];

const CLIENTS_PER_IMAGE = 8;

function chunkClients(clients: ClientWithBalance[]) {
  const pages: ClientWithBalance[][] = [];
  for (let index = 0; index < clients.length; index += CLIENTS_PER_IMAGE) {
    pages.push(clients.slice(index, index + CLIENTS_PER_IMAGE));
  }
  return pages;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "etiqueta";
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

function TagSharePage({ allClients, businessName, clients, pageNumber, pageTotal, tagName }: {
  allClients: ClientWithBalance[];
  businessName: string;
  clients: ClientWithBalance[];
  pageNumber: number;
  pageTotal: number;
  tagName: string;
}) {
  const totals = allClients.reduce((result, client) => ({
    principal: result.principal + (client.balance?.principal_balance_cents ?? 0),
    interest: result.interest + (client.balance?.interest_balance_cents ?? 0),
    total: result.total + (client.balance?.total_balance_cents ?? 0),
  }), { principal: 0, interest: 0, total: 0 });

  return (
    <article className="w-[390px] bg-white p-6 text-kredo-ink">
      <header className="border-b border-kredo-line pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kredo-primary">{businessName}</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div><p className="text-sm text-kredo-muted">Etiqueta</p><h1 className="text-2xl font-bold">{tagName}</h1></div>
          <div className="text-right text-xs text-kredo-muted"><p>{toDateInputValue()}</p>{pageTotal > 1 ? <p className="mt-1">Página {pageNumber} de {pageTotal}</p> : null}</div>
        </div>
      </header>
      <section className="mt-4 space-y-2">
        {clients.map((client) => (
          <div className="rounded-md border border-kredo-line p-3" key={client.id}>
            <div className="flex items-start justify-between gap-3"><p className="font-semibold">{client.full_name}</p><span className="whitespace-nowrap text-xs font-semibold text-kredo-muted">{statusLabels[client.status]}</span></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-kredo-muted">Capital</p><p className="font-semibold">{formatMoney(client.balance?.principal_balance_cents ?? 0)}</p></div>
              <div><p className="text-kredo-muted">Interés</p><p className="font-semibold">{formatMoney(client.balance?.interest_balance_cents ?? 0)}</p></div>
              <div><p className="text-kredo-muted">Total</p><p className="font-bold">{formatMoney(client.balance?.total_balance_cents ?? 0)}</p></div>
            </div>
          </div>
        ))}
      </section>
      <section className="mt-4 rounded-md bg-kredo-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">Totales de la etiqueta · {allClients.length} clientes</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div><p className="text-kredo-muted">Capital</p><p className="font-semibold">{formatMoney(totals.principal)}</p></div>
          <div><p className="text-kredo-muted">Interés</p><p className="font-semibold">{formatMoney(totals.interest)}</p></div>
          <div><p className="text-kredo-muted">Total</p><p className="font-bold">{formatMoney(totals.total)}</p></div>
        </div>
      </section>
      <p className="mt-4 text-center text-[11px] text-kredo-muted">Resumen generado desde Kredo.</p>
    </article>
  );
}

export function ClientsPage() {
  const { organization } = useOrganization();
  const [activeFilter, setActiveFilter] = useState<ClientFilter>("all");
  const [activeTagId, setActiveTagId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const sharePageRefs = useRef<Array<HTMLElement | null>>([]);
  const preparedImagesRef = useRef<Array<{ blob: Blob; file: File; fileName: string }>>([]);

  const { data: clients = [], isLoading, error } = useQuery({ queryKey: ["clients"], queryFn: listClientsWithBalances });
  const { data: tags = [], error: tagsError } = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? null;
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

  const filteredClients = useMemo(() => clients
    .filter((client) => activeFilter === "all" || client.status === activeFilter)
    .filter((client) => activeTagId === "all" || client.tags.some((tag) => tag.id === activeTagId))
    .filter((client) => !normalizedSearch || [client.full_name, client.identification, client.phone, client.client_code]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalizedSearch)))
    .sort((first, second) => {
      const statusDifference = statusPriority[first.status] - statusPriority[second.status];
      if (statusDifference !== 0) return statusDifference;
      const firstBalance = first.balance?.total_balance_cents ?? 0;
      const secondBalance = second.balance?.total_balance_cents ?? 0;
      return secondBalance - firstBalance || first.full_name.localeCompare(second.full_name);
    }), [activeFilter, activeTagId, clients, normalizedSearch]);

  const sharePages = useMemo(() => activeTag ? chunkClients(filteredClients) : [], [activeTag, filteredClients]);
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    clients.forEach((client) => client.tags.forEach((tag) => counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1)));
    return counts;
  }, [clients]);

  const prepareShareImages = useCallback(async () => {
    if (!activeTag || sharePages.length === 0) return [];
    const images = await Promise.all(sharePages.map(async (_page, index) => {
      const element = sharePageRefs.current[index];
      if (!element) throw new Error("Share page is not ready");
      const canvas = await html2canvas(element, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image could not be created")), "image/png"));
      const suffix = sharePages.length > 1 ? `-${index + 1}` : "";
      const fileName = `kredo-${slugify(activeTag.name)}-${toDateInputValue()}${suffix}.png`;
      return { blob, file: new File([blob], fileName, { type: "image/png" }), fileName };
    }));
    preparedImagesRef.current = images;
    return images;
  }, [activeTag, sharePages]);

  useEffect(() => {
    preparedImagesRef.current = [];
    setShareMessage("");
    if (!activeTag || sharePages.length === 0) return;
    let cancelled = false;
    setIsPreparingImages(true);
    const frame = window.requestAnimationFrame(() => {
      prepareShareImages().catch(() => {
        if (!cancelled) setShareMessage("No se pudo preparar la imagen. Intenta nuevamente.");
      }).finally(() => {
        if (!cancelled) setIsPreparingImages(false);
      });
    });
    return () => { cancelled = true; window.cancelAnimationFrame(frame); };
  }, [activeTag, prepareShareImages, sharePages.length]);

  async function handleDownloadImages() {
    setShareMessage("");
    setIsPreparingImages(true);
    try {
      const images = preparedImagesRef.current.length ? preparedImagesRef.current : await prepareShareImages();
      images.forEach((image) => downloadBlob(image.blob, image.fileName));
    } catch {
      setShareMessage("No se pudieron generar las imágenes. Intenta nuevamente.");
    } finally {
      setIsPreparingImages(false);
    }
  }

  async function handleShareImages() {
    setShareMessage("");
    const images = preparedImagesRef.current;
    if (!activeTag || images.length === 0) { setShareMessage("Las imágenes todavía se están preparando."); return; }
    if (!window.isSecureContext || !("share" in navigator) || !navigator.canShare?.({ files: images.map((image) => image.file) })) {
      images.forEach((image) => downloadBlob(image.blob, image.fileName));
      setShareMessage("Tu navegador no permite compartir estas imágenes directamente. Se descargaron para enviarlas por WhatsApp.");
      return;
    }
    try {
      await navigator.share({ title: `Etiqueta ${activeTag.name}`, text: `Resumen de la etiqueta ${activeTag.name}`, files: images.map((image) => image.file) });
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setShareMessage("No se pudo abrir el menú de compartir. Puedes descargar las imágenes y enviarlas por WhatsApp.");
    }
  }

  const canShareTag = Boolean(activeTag && filteredClients.length > 0);

  return (
    <section>
      <PageHeader eyebrow="Clientes" title="Clientes" />
      <div className="mb-4 flex gap-2">
        <label className="flex min-h-12 flex-1 items-center gap-2 rounded-md border border-kredo-line bg-white px-3"><Search className="h-5 w-5 text-kredo-muted" aria-hidden="true" /><input className="min-w-0 flex-1 bg-transparent text-base outline-none" onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nombre, cédula o teléfono" type="search" value={searchTerm} /></label>
        <Link aria-label="Crear cliente" className="inline-flex min-h-12 items-center justify-center rounded-md bg-kredo-primary px-4 text-white" to="/clients/new"><Plus className="h-5 w-5" aria-hidden="true" /></Link>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted"><Tag className="h-4 w-4" aria-hidden="true" /> Etiquetas</div>
      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1"><div className="flex w-max gap-2" role="group" aria-label="Filtrar clientes por etiqueta">
        <button aria-pressed={activeTagId === "all"} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${activeTagId === "all" ? "border-kredo-primary bg-kredo-primary text-white" : "border-kredo-line bg-white text-kredo-muted"}`} onClick={() => setActiveTagId("all")} type="button">Todas</button>
        {tags.map((tag) => <button aria-pressed={activeTagId === tag.id} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${activeTagId === tag.id ? "border-kredo-primary bg-kredo-primary text-white" : "border-kredo-line bg-white text-kredo-muted"}`} key={tag.id} onClick={() => setActiveTagId(tag.id)} type="button">{tag.name} <span className="opacity-75">({tagCounts.get(tag.id) ?? 0})</span></button>)}
      </div></div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">Estado</div>
      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1"><div className="flex w-max gap-2" role="group" aria-label="Filtrar clientes por estado">
        {clientFilters.map((filter) => <button aria-pressed={activeFilter === filter.id} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${activeFilter === filter.id ? "border-kredo-primary bg-kredo-primary text-white" : "border-kredo-line bg-white text-kredo-muted"}`} key={filter.id} onClick={() => setActiveFilter(filter.id)} type="button">{filter.label}</button>)}
      </div></div>

      {activeTag ? <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3"><div className="flex items-center justify-between gap-3">
        <div><p className="text-xs text-kredo-muted">Vista actual</p><p className="font-semibold text-kredo-ink">{activeTag.name} · {filteredClients.length} {filteredClients.length === 1 ? "cliente" : "clientes"}</p></div>
        <div className="flex gap-2"><button aria-label="Descargar imágenes" className="inline-flex min-h-11 items-center justify-center rounded-md border border-blue-200 bg-white px-3 text-kredo-primary disabled:opacity-50" disabled={!canShareTag || isPreparingImages} onClick={handleDownloadImages} type="button"><Download className="h-5 w-5" aria-hidden="true" /></button><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-kredo-green px-3 font-semibold text-white disabled:opacity-50" disabled={!canShareTag || isPreparingImages} onClick={handleShareImages} type="button"><Share2 className="h-5 w-5" aria-hidden="true" />{isPreparingImages ? "Preparando" : "Compartir"}</button></div>
      </div>{shareMessage ? <p className="mt-2 text-sm font-medium text-kredo-yellow">{shareMessage}</p> : null}</div> : null}

      {isLoading ? <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando clientes...</article> : null}
      {error || tagsError ? <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">No se pudieron cargar los clientes o sus etiquetas. Refresca la página e intenta nuevamente.</article> : null}

      <div className="space-y-3">{filteredClients.map((client) => <article className="rounded-lg border border-kredo-line bg-white p-4" key={client.id}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">{client.client_code}</p><h2 className="mt-1 font-semibold text-kredo-ink">{client.full_name}</h2><p className="mt-1 text-sm text-kredo-muted">{client.identification ?? "Cédula pendiente"} · {client.phone ?? "Teléfono pendiente"}</p></div><StatusBadge status={client.status} /></div>
        {client.tags.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5">{client.tags.map((tag) => <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-kredo-primary" key={tag.id}>{tag.name}</span>)}</div> : null}
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><p className="text-kredo-muted">Capital</p><p className="font-semibold">{formatMoney(client.balance?.principal_balance_cents ?? 0)}</p></div><div><p className="text-kredo-muted">Interés</p><p className="font-semibold">{formatMoney(client.balance?.interest_balance_cents ?? 0)}</p></div><div><p className="text-kredo-muted">Total</p><p className="font-semibold">{formatMoney(client.balance?.total_balance_cents ?? 0)}</p></div></div>
        <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-kredo-line font-semibold" to={`/clients/${client.id}`}>Abrir perfil</Link>
      </article>)}</div>

      {!isLoading && !error && clients.length === 0 ? <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">Aún no hay clientes registrados en esta empresa.</article> : null}
      {!isLoading && !error && clients.length > 0 && filteredClients.length === 0 ? <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">No hay clientes que coincidan con la búsqueda y los filtros seleccionados.</article> : null}

      {activeTag ? <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">{sharePages.map((page, index) => <div className="mb-4" key={`${activeTag.id}-${index}`} ref={(element) => { sharePageRefs.current[index] = element; }}><TagSharePage allClients={filteredClients} businessName={organization?.name ?? "Kredo"} clients={page} pageNumber={index + 1} pageTotal={sharePages.length} tagName={activeTag.name} /></div>)}</div> : null}
    </section>
  );
}
