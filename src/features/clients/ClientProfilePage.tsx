import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/money";
import { getClientWithBalance } from "@/services/clients.service";
import { listClientMovements, type ClientMovementRow } from "@/services/movements.service";
import { voidLoan } from "@/services/loans.service";
import { useAuth } from "@/features/auth/AuthProvider";
import { generateDueInterestForClient, getClientInterestStatus } from "@/services/interest.service";

const movementLabels: Record<ClientMovementRow["movement_type"], string> = {
  loan: "Prestamo",
  payment: "Pago",
  interest_charge: "Interes generado",
  adjustment: "Ajuste",
  note: "Nota",
};

export function ClientProfilePage() {
  const { clientId = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [movementToVoid, setMovementToVoid] = useState<ClientMovementRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");

  const { data: client, isLoading, error } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientWithBalance(clientId),
    enabled: Boolean(clientId),
  });

  const {
    data: movements = [],
    isLoading: movementsLoading,
    error: movementsError,
  } = useQuery({
    queryKey: ["client-movements", clientId],
    queryFn: () => listClientMovements(clientId),
    enabled: Boolean(clientId),
  });

  const {
    data: interestStatus,
    isLoading: interestStatusLoading,
    error: interestStatusError,
  } = useQuery({
    queryKey: ["client-interest-status", clientId],
    queryFn: () => getClientInterestStatus(clientId),
    enabled: Boolean(clientId),
  });

  const voidMutation = useMutation({
    mutationFn: voidLoan,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-movements", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      setMovementToVoid(null);
      setVoidReason("");
      setVoidError("");
    },
    onError: () => {
      setVoidError("No se pudo anular el movimiento. Revisa la conexion e intenta otra vez.");
    },
  });

  const generateInterestMutation = useMutation({
    mutationFn: () => generateDueInterestForClient(clientId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-movements", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-interest-status", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });

  function handleVoidConfirm() {
    setVoidError("");

    if (!user || !movementToVoid) {
      setVoidError("Debes iniciar sesion para anular movimientos.");
      return;
    }

    if (!voidReason.trim()) {
      setVoidError("Escribe el motivo de anulacion.");
      return;
    }

    if (movementToVoid.movement_type !== "loan") {
      setVoidError("Por ahora solo se pueden anular prestamos desde esta pantalla.");
      return;
    }

    voidMutation.mutate({
      loanId: movementToVoid.movement_id,
      userId: user.id,
      reason: voidReason,
    });
  }

  if (isLoading) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando perfil desde Supabase...</article>;
  }

  if (error) {
    return <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">No se pudo cargar el perfil.</article>;
  }

  if (!client) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cliente no encontrado.</article>;
  }

  return (
    <section>
      <PageHeader eyebrow="Perfil" title={client.full_name} description="Perfil conectado a Supabase." />

      <div className="mb-4 flex items-center justify-between rounded-lg border border-kredo-line bg-white p-4">
        <div>
          <p className="text-sm text-kredo-muted">Telefono</p>
          <p className="font-semibold">{client.phone ?? "Pendiente"}</p>
        </div>
        <StatusBadge status={client.status} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <MetricCard label="Capital" value={formatMoney(client.balance?.principal_balance_cents ?? 0)} />
        <MetricCard label="Interes" value={formatMoney(client.balance?.interest_balance_cents ?? 0)} />
        <MetricCard label="Total" value={formatMoney(client.balance?.total_balance_cents ?? 0)} />
        <MetricCard label="Proximo cierre" value={interestStatus?.nextCloseDate ?? "Cargando"} />
      </div>

      <div className="mb-4 rounded-lg border border-kredo-line bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-kredo-ink">Intereses por ciclo</h2>
            <p className="mt-1 text-sm text-kredo-muted">Cierres configurados los dias 15 y 30.</p>
          </div>
          <p className="text-right text-lg font-bold">{formatMoney(interestStatus?.dueInterestCents ?? 0)}</p>
        </div>

        {interestStatusLoading ? <p className="mt-3 text-sm text-kredo-muted">Revisando ciclos vencidos...</p> : null}

        {interestStatusError ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">
            No se pudieron calcular los ciclos de interes.
          </p>
        ) : null}

        {(interestStatus?.dueCycles.length ?? 0) > 0 ? (
          <div className="mt-3 space-y-2">
            {interestStatus?.dueCycles.map((cycle) => (
              <div className="rounded-md bg-kredo-surface p-3 text-sm" key={cycle.endDate}>
                <div className="flex justify-between gap-3">
                  <span className="text-kredo-muted">Cierre {cycle.endDate}</span>
                  <span className="font-semibold">{formatMoney(cycle.interestAmountCents)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-3 text-xs">
                  <span className="text-kredo-muted">Base {formatMoney(cycle.principalBaseCents)}</span>
                  <span className={cycle.alreadyGenerated ? "font-semibold text-kredo-green" : "font-semibold text-kredo-yellow"}>
                    {cycle.alreadyGenerated ? "Generado" : "Pendiente"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {(interestStatus?.dueInterestCents ?? 0) > 0 ? (
          <button
            className="mt-4 min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={generateInterestMutation.isPending}
            onClick={() => generateInterestMutation.mutate()}
            type="button"
          >
            {generateInterestMutation.isPending ? "Generando..." : "Generar intereses vencidos"}
          </button>
        ) : null}

        {generateInterestMutation.isError ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">
            No se pudieron generar los intereses. Revisa la conexion e intenta otra vez.
          </p>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link className="min-h-12 rounded-md bg-kredo-primary px-3 py-3 text-center font-semibold text-white" to="/loans/new">
          Nuevo prestamo
        </Link>
        <Link className="min-h-12 rounded-md border border-kredo-line bg-white px-3 py-3 text-center font-semibold" to="/payments/new">
          Registrar pago
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Historial</h2>
        {movementsLoading ? (
          <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando historial...</article>
        ) : null}

        {movementsError ? (
          <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">
            No se pudo cargar el historial.
          </article>
        ) : null}

        <div className="space-y-3">
          {movements.map((movement) => {
            const isVoided = Boolean(movement.voided_at);
            const canVoid = movement.movement_type === "loan" && !isVoided;

            return (
              <article className="rounded-lg border border-kredo-line bg-white p-4" key={`${movement.movement_type}-${movement.movement_id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">{movement.movement_date}</p>
                    <h3 className="mt-1 font-semibold text-kredo-ink">{movementLabels[movement.movement_type]}</h3>
                    {movement.notes ? <p className="mt-1 text-sm text-kredo-muted">{movement.notes}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatMoney(movement.amount_cents)}</p>
                    {isVoided ? (
                      <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                        Anulado
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-kredo-muted">Capital</p>
                    <p className="font-semibold">{formatMoney(movement.principal_amount_cents)}</p>
                  </div>
                  <div>
                    <p className="text-kredo-muted">Interes</p>
                    <p className="font-semibold">{formatMoney(movement.interest_amount_cents)}</p>
                  </div>
                </div>

                {canVoid ? (
                  <button
                    className="mt-4 min-h-11 w-full rounded-md border border-red-200 bg-red-50 px-4 py-2 font-semibold text-kredo-red"
                    onClick={() => {
                      setMovementToVoid(movement);
                      setVoidReason("");
                      setVoidError("");
                    }}
                    type="button"
                  >
                    Anular prestamo
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>

        {!movementsLoading && !movementsError && movements.length === 0 ? (
          <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
            Este cliente aun no tiene movimientos.
          </article>
        ) : null}
      </div>

      {movementToVoid ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/30 px-4 pb-4">
          <section className="w-full rounded-lg border border-kredo-line bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold">Anular prestamo</h2>
            <p className="mt-2 text-sm text-kredo-muted">
              Este prestamo dejara de contar en el saldo, pero seguira visible en el historial como anulado.
            </p>
            <div className="mt-4 rounded-md bg-kredo-surface p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-kredo-muted">Monto</span>
                <span className="font-semibold">{formatMoney(movementToVoid.amount_cents)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-kredo-muted">Fecha</span>
                <span className="font-semibold">{movementToVoid.movement_date}</span>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-kredo-ink">Motivo</span>
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-kredo-line bg-white px-3 py-3 text-base outline-none focus:border-kredo-primary"
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Ejemplo: monto registrado incorrectamente"
                value={voidReason}
              />
            </label>

            {voidError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">{voidError}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="min-h-12 rounded-md border border-kredo-line bg-white px-4 py-3 font-semibold"
                disabled={voidMutation.isPending}
                onClick={() => setMovementToVoid(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="min-h-12 rounded-md bg-kredo-red px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={voidMutation.isPending}
                onClick={handleVoidConfirm}
                type="button"
              >
                {voidMutation.isPending ? "Anulando..." : "Anular"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
