import { useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

export type MetricDetail = {
  title: string;
  value: string;
  description: string;
  formula?: string;
  rows?: Array<{ label: string; value: string }>;
  note?: string;
  action?: { label: string; to: string };
};

type MetricDetailsModalProps = {
  detail: MetricDetail;
  onClose: () => void;
};

export function MetricDetailsModal({ detail, onClose }: MetricDetailsModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      aria-label={`Detalle de ${detail.title}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
    >
      <article
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-kredo-primary">Como se calcula</p>
            <h2 className="mt-1 text-xl font-bold text-kredo-ink">{detail.title}</h2>
          </div>
          <button aria-label="Cerrar detalle" className="rounded-md border border-kredo-line p-2" onClick={onClose} type="button">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-3xl font-bold text-kredo-ink">{detail.value}</p>
        <p className="mt-2 text-sm text-kredo-muted">{detail.description}</p>

        {detail.formula ? (
          <p className="mt-4 rounded-lg bg-kredo-surface px-3 py-3 text-sm font-medium text-kredo-ink">{detail.formula}</p>
        ) : null}

        {detail.rows?.length ? (
          <dl className="mt-4 divide-y divide-kredo-line rounded-lg border border-kredo-line px-3">
            {detail.rows.map((row, index) => (
              <div className="flex items-center justify-between gap-4 py-3 text-sm" key={`${row.label}-${index}`}>
                <dt className="text-kredo-muted">{row.label}</dt>
                <dd className="text-right font-semibold text-kredo-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {detail.note ? <p className="mt-4 text-xs text-kredo-muted">{detail.note}</p> : null}

        <div className="mt-5 grid gap-2">
          {detail.action ? (
            <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-kredo-primary px-4 font-semibold text-white" onClick={onClose} to={detail.action.to}>
              {detail.action.label}
            </Link>
          ) : null}
          <button className="min-h-11 rounded-md border border-kredo-line px-4 font-semibold" onClick={onClose} type="button">
            Entendido
          </button>
        </div>
      </article>
    </div>
  );
}
