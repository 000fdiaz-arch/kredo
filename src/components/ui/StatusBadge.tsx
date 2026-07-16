import { clsx } from "clsx";
import type { ClientStatus } from "@/types/domain";

const statusMap: Record<ClientStatus, { label: string; className: string }> = {
  current: { label: "Al dia", className: "bg-green-50 text-kredo-green ring-green-200" },
  interest_pending: { label: "Interes pendiente", className: "bg-yellow-50 text-kredo-yellow ring-yellow-200" },
  late: { label: "Atrasado", className: "bg-red-50 text-kredo-red ring-red-200" },
  no_movements: { label: "Sin movimientos", className: "bg-gray-100 text-gray-700 ring-gray-200" },
  inactive: { label: "Inactivo", className: "bg-gray-100 text-gray-600 ring-gray-200" },
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  const config = statusMap[status];

  return (
    <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", config.className)}>
      {config.label}
    </span>
  );
}
