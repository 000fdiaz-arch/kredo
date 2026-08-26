import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus, Search, Share2, Tag, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { listClientsWithBalances, type ClientWithBalance } from "@/services/clients.service";
import { addClientTag, createTag, listTags, removeClientTag } from "@/services/tags.service";
import { useAuth } from "@/features/auth/AuthProvider";
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

function TagSharePage({ allClients, businessName, captureRef, clients, pageNumber, pageTotal, tagName }: {
  allClients: ClientWithBalance[];
  businessName: string;
  captureRef: (element: HTMLElement | null) => void;
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

  const headingCell = {
    borderBottom: "2px solid #1463ff",
    color: "#344054",
    fontSize: "15px",
    fontWeight: 700,
    padding: "14px 12px",
    textAlign: "left" as const,
    verticalAlign: "bottom" as const,
  };
  const amountHeadingCell = { ...headingCell, textAlign: "right" as const };
  const bodyCell = {
    borderBottom: "1px solid #d9dee8",
    fontSize: "17px",
    padding: "16px 12px",
  };
  const amountBodyCell = { ...bodyCell, textAlign: "right" as const, whiteSpace: "nowrap" as const };

  return (
    <article ref={captureRef} style={{ background: "#ffffff", boxSizing: "border-box", color: "#172033", fontFamily: "Arial, Helvetica, sans-serif", padding: "40px", width: "720px" }}>
      <header style={{ borderBottom: "1px solid #d9dee8", paddingBottom: "22px" }}>
        <p style={{ color: "#1463ff", fontSize: "14px", fontWeight: 700, letterSpacing: "2px", margin: 0, textTransform: "uppercase" }}>{businessName}</p>
        <div style={{ alignItems: "flex-end", display: "flex", justifyContent: "space-between", marginTop: "14px" }}>
          <div>
            <p style={{ color: "#667085", fontSize: "14px", margin: "0 0 5px" }}>Etiqueta</p>
            <h1 style={{ fontSize: "30px", lineHeight: 1.15, margin: 0 }}>{tagName}</h1>
          </div>
          <div style={{ color: "#667085", fontSize: "13px", lineHeight: 1.5, textAlign: "right" }}>
            <p style={{ margin: 0 }}>{toDateInputValue()}</p>
            {pageTotal > 1 ? <p style={{ margin: 0 }}>Página {pageNumber} de {pageTotal}</p> : null}
          </div>
        </div>
      </header>

      <table style={{ borderCollapse: "collapse", marginTop: "24px", tableLayout: "fixed", width: "100%" }}>
        <thead>
          <tr style={{ background: "#f7f8fb" }}>
            <th style={{ ...headingCell, width: "34%" }}>Nombre</th>
            <th style={{ ...amountHeadingCell, width: "20%" }}>Capital</th>
            <th style={{ ...amountHeadingCell, width: "18%" }}>Interés</th>
            <th style={{ ...amountHeadingCell, width: "28%" }}>Monto total<br />a pagar</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, index) => (
            <tr key={client.id} style={{ background: index % 2 === 0 ? "#ffffff" : "#fbfcfe" }}>
              <td style={{ ...bodyCell, fontWeight: 700 }}>{client.full_name}</td>
              <td style={amountBodyCell}>{formatMoney(client.balance?.principal_balance_cents ?? 0)}</td>
              <td style={amountBodyCell}>{formatMoney(client.balance?.interest_balance_cents ?? 0)}</td>
              <td style={{ ...amountBodyCell, fontWeight: 700 }}>{formatMoney(client.balance?.total_balance_cents ?? 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#eaf1ff" }}>
            <td style={{ fontSize: "15px", fontWeight: 700, padding: "18px 12px" }}>Total general · {allClients.length} clientes</td>
            <td style={{ ...amountBodyCell, borderBottom: 0, fontWeight: 700 }}>{formatMoney(totals.principal)}</td>
            <td style={{ ...amountBodyCell, borderBottom: 0, fontWeight: 700 }}>{formatMoney(totals.interest)}</td>
            <td style={{ ...amountBodyCell, borderBottom: 0, color: "#1463ff", fontWeight: 800 }}>{formatMoney(totals.total)}</td>
          </tr>
        </tfoot>
      </table>

      <p style={{ color: "#667085", fontSize: "12px", margin: "20px 0 0", textAlign: "center" }}>Resumen generado desde Kredo.</p>
    </article>
  );
}

export function ClientsPage() {
  const { user } = useAuth();
  const { organization, organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<ClientFilter>("all");
  const [activeTagId, setActiveTagId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [tagManagerClientId, setTagManagerClientId] = useState<string | null>(null);
  const [quickTagName, setQuickTagName] = useState("");
  const [tagManagerError, setTagManagerError] = useState("");
  const sharePageRefs = useRef<Array<HTMLElement | null>>([]);
  const preparedImagesRef = useRef<Array<{ blob: Blob; file: File; fileName: string }>>([]);

  const { data: clients = [], isLoading, error } = useQuery({ queryKey: ["clients"], queryFn: listClientsWithBalances });
  const { data: tags = [], error: tagsError } = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? null;
  const managedClient = clients.find((client) => client.id === tagManagerClientId) ?? null;
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

  const tagAssignmentMutation = useMutation({
    mutationFn: async (input: { clientId: string; tagId: string; assigned: boolean }) => {
      if (!organizationId) throw new Error("Organization required");
      const operation = input.assigned ? removeClientTag : addClientTag;
      await operation({ clientId: input.clientId, organizationId, tagId: input.tagId });
    },
    onSuccess: async () => {
      setTagManagerError("");
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (_error, input) => {
      setTagManagerClientId(input.clientId);
      setTagManagerError("No se pudo actualizar la etiqueta. Intenta nuevamente.");
    },
  });

  const quickTagMutation = useMutation({
    mutationFn: async () => {
      if (!user || !organizationId || !managedClient) throw new Error("Authentication required");
      const tag = await createTag({ organizationId, userId: user.id, name: quickTagName });
      await addClientTag({ clientId: managedClient.id, organizationId, tagId: tag.id });
    },
    onSuccess: async () => {
      setQuickTagName("");
      setTagManagerError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["tags"] }),
      ]);
    },
    onError: () => setTagManagerError("No se pudo crear la etiqueta. Revisa el nombre e intenta nuevamente."),
  });

  function toggleClientTag(clientId: string, tagId: string, assigned: boolean) {
    setTagManagerError("");
    tagAssignmentMutation.mutate({ clientId, tagId, assigned });
  }

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
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">{client.client_code}</p><h2 className="mt-1 font-semibold text-kredo-ink">{client.full_name}</h2><p className="mt-1 text-sm text-kredo-muted">{client.identification ?? "Cédula pendiente"} · {client.phone ?? "Teléfono pendiente"}</p></div><div className="flex shrink-0 items-center gap-1.5"><button aria-label={`Administrar etiquetas de ${client.full_name}`} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-full border border-kredo-line bg-white px-2 text-xs font-semibold text-kredo-primary" onClick={() => { setTagManagerClientId(client.id); setQuickTagName(""); setTagManagerError(""); }} type="button"><Tag className="h-3.5 w-3.5" aria-hidden="true" />Etiquetas</button><StatusBadge status={client.status} /></div></div>
        {client.tags.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5">{client.tags.map((tag) => <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-kredo-primary" key={tag.id}>{tag.name}<button aria-label={`Quitar etiqueta ${tag.name} de ${client.full_name}`} className="rounded-full p-1 hover:bg-blue-100 disabled:opacity-50" disabled={tagAssignmentMutation.isPending} onClick={() => toggleClientTag(client.id, tag.id, true)} type="button"><X className="h-3.5 w-3.5" aria-hidden="true" /></button></span>)}</div> : null}
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><p className="text-kredo-muted">Capital</p><p className="font-semibold">{formatMoney(client.balance?.principal_balance_cents ?? 0)}</p></div><div><p className="text-kredo-muted">Interés</p><p className="font-semibold">{formatMoney(client.balance?.interest_balance_cents ?? 0)}</p></div><div><p className="text-kredo-muted">Total</p><p className="font-semibold">{formatMoney(client.balance?.total_balance_cents ?? 0)}</p></div></div>
        <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-kredo-line font-semibold" to={`/clients/${client.id}`}>Abrir perfil</Link>
      </article>)}</div>

      {!isLoading && !error && clients.length === 0 ? <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">Aún no hay clientes registrados en esta empresa.</article> : null}
      {!isLoading && !error && clients.length > 0 && filteredClients.length === 0 ? <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">No hay clientes que coincidan con la búsqueda y los filtros seleccionados.</article> : null}

      {activeTag ? <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">{sharePages.map((page, index) => <TagSharePage allClients={filteredClients} businessName={organization?.name ?? "Kredo"} captureRef={(element) => { sharePageRefs.current[index] = element; }} clients={page} key={`${activeTag.id}-${index}`} pageNumber={index + 1} pageTotal={sharePages.length} tagName={activeTag.name} />)}</div> : null}

      {managedClient ? <div className="fixed inset-0 z-40 flex items-end bg-black/30 px-4 pb-4"><section aria-labelledby="tag-manager-title" className="w-full rounded-lg border border-kredo-line bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">Cliente</p><h2 className="mt-1 text-lg font-bold" id="tag-manager-title">Etiquetas de {managedClient.full_name}</h2></div><button aria-label="Cerrar etiquetas" className="rounded-full border border-kredo-line p-2 text-kredo-muted" onClick={() => setTagManagerClientId(null)} type="button"><X className="h-5 w-5" aria-hidden="true" /></button></div>

        <p className="mt-4 text-sm font-medium text-kredo-ink">Toca una etiqueta para agregarla o quitarla.</p>
        {tags.length > 0 ? <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">{tags.map((tag) => {
          const assigned = managedClient.tags.some((clientTag) => clientTag.id === tag.id);
          return <button aria-pressed={assigned} className={`min-h-10 rounded-full border px-3 text-sm font-semibold disabled:opacity-50 ${assigned ? "border-kredo-primary bg-blue-50 text-kredo-primary" : "border-kredo-line bg-white text-kredo-muted"}`} disabled={tagAssignmentMutation.isPending || quickTagMutation.isPending} key={tag.id} onClick={() => toggleClientTag(managedClient.id, tag.id, assigned)} type="button">{assigned ? "✓ " : "+ "}{tag.name}</button>;
        })}</div> : <p className="mt-3 rounded-md bg-kredo-surface p-3 text-sm text-kredo-muted">Todavía no hay etiquetas. Crea la primera aquí.</p>}

        <div className="mt-5 border-t border-kredo-line pt-4"><label className="text-sm font-medium text-kredo-ink" htmlFor="quick-tag-name">Crear y agregar una etiqueta</label><div className="mt-2 flex gap-2"><input className="min-h-12 min-w-0 flex-1 rounded-md border border-kredo-line bg-white px-3 text-base outline-none focus:border-kredo-primary" id="quick-tag-name" maxLength={40} onChange={(event) => setQuickTagName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && quickTagName.trim()) quickTagMutation.mutate(); }} placeholder="Ejemplo: Cobrar viernes" value={quickTagName} /><button className="inline-flex min-h-12 items-center justify-center gap-1 rounded-md bg-kredo-primary px-4 font-semibold text-white disabled:opacity-50" disabled={!quickTagName.trim() || quickTagMutation.isPending || tagAssignmentMutation.isPending} onClick={() => quickTagMutation.mutate()} type="button"><Plus className="h-4 w-4" aria-hidden="true" />Agregar</button></div></div>

        {tagManagerError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">{tagManagerError}</p> : null}
        <button className="mt-4 min-h-12 w-full rounded-md border border-kredo-line bg-white px-4 py-3 font-semibold" onClick={() => setTagManagerClientId(null)} type="button">Listo</button>
      </section></div> : null}
    </section>
  );
}
