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
import { useOrganization } from "@/features/organizations/OrganizationProvider";
import { generatePaymentInterestForClient, getClientInterestStatus } from "@/services/interest.service";
import { getNextCycleRange, toDateInputValue } from "@/lib/dates";
import {
  changeClientInterestRate,
  freezeClientInterest,
  getClientInterestPolicyStatus,
  resumeClientInterest,
} from "@/services/interest-policy.service";

const movementLabels: Record<ClientMovementRow["movement_type"], string> = {
  loan: "Prestamo",
  payment: "Pago",
  interest_charge: "Interes generado",
  adjustment: "Ajuste",
  note: "Nota",
};

type InterestPolicyAction = "rate" | "freeze" | "resume";

export function ClientProfilePage() {
  const { clientId = "" } = useParams();
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const [movementToVoid, setMovementToVoid] = useState<ClientMovementRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");
  const [interestMessage, setInterestMessage] = useState("");
  const [policyAction, setPolicyAction] = useState<InterestPolicyAction | null>(null);
  const [policyReason, setPolicyReason] = useState("");
  const [newInterestRate, setNewInterestRate] = useState("");
  const [policyError, setPolicyError] = useState("");

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
    data: interestPolicy,
    isLoading: interestPolicyLoading,
    error: interestPolicyError,
  } = useQuery({
    queryKey: ["client-interest-policy", clientId],
    queryFn: () => getClientInterestPolicyStatus(clientId),
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
    mutationFn: () => generatePaymentInterestForClient(clientId, toDateInputValue()),
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-movements", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-interest-status", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      setInterestMessage(
        created.length > 0
          ? `${created.length === 1 ? "Cargo generado" : "Cargos generados"} correctamente.`
          : "Los cargos de este ciclo ya estaban generados o no hay capital sujeto a interes.",
      );
    },
  });

  const policyMutation = useMutation({
    mutationFn: async (input: { action: InterestPolicyAction; reason: string; interestRateBps?: number }) => {
      if (!user || !organizationId) throw new Error("Authentication required");

      const today = toDateInputValue();
      const nextRateClose = interestStatus?.nextCloseDate === today
        ? getNextCycleRange(today).endDate
        : interestStatus?.nextCloseDate;

      const baseInput = {
        userId: user.id,
        organizationId,
        clientId,
        reason: input.reason,
        effectiveDate: input.action === "rate" ? nextRateClose : today,
      };

      if (input.action === "freeze") return freezeClientInterest(baseInput);
      if (input.action === "resume") return resumeClientInterest(baseInput);
      return changeClientInterestRate({ ...baseInput, interestRateBps: input.interestRateBps ?? 0 });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client-interest-policy", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-interest-status", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      setPolicyAction(null);
      setPolicyReason("");
      setNewInterestRate("");
      setPolicyError("");
    },
    onError: (mutationError) => {
      setPolicyError(
        mutationError instanceof Error && mutationError.message === "No active loans"
          ? "Este cliente no tiene prestamos activos para cambiar la tasa."
          : "No se pudo guardar el cambio. Revisa la conexion e intenta otra vez.",
      );
    },
  });

  function openPolicyAction(action: InterestPolicyAction) {
    setPolicyAction(action);
    setPolicyReason("");
    setPolicyError("");
    setNewInterestRate(
      action === "rate" && interestPolicy?.currentRateBps != null
        ? String(interestPolicy.currentRateBps / 100)
        : "",
    );
  }

  function handlePolicyConfirm() {
    if (!policyAction) return;

    const reason = policyReason.trim();
    if (!reason) {
      setPolicyError("Escribe el motivo del cambio.");
      return;
    }

    if (policyAction === "rate") {
      const rate = Number(newInterestRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        setPolicyError("El interes debe estar entre 0% y 100%.");
        return;
      }
      policyMutation.mutate({ action: policyAction, reason, interestRateBps: Math.round(rate * 100) });
      return;
    }

    policyMutation.mutate({ action: policyAction, reason });
  }

  function handleVoidConfirm() {
    setVoidError("");

    if (!user || !organizationId || !movementToVoid) {
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
      organizationId,
      reason: voidReason,
    });
  }

  if (isLoading) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando perfil...</article>;
  }

  if (error) {
    return <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">No se pudo cargar el perfil.</article>;
  }

  if (!client) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cliente no encontrado.</article>;
  }

  return (
    <section>
      <PageHeader eyebrow="Perfil" title={client.full_name} description="Informacion, saldo e historial del cliente." />

      <div className="mb-4 flex items-center justify-between rounded-lg border border-kredo-line bg-white p-4">
        <div>
          <p className="text-sm text-kredo-muted">Telefono</p>
          <p className="font-semibold">{client.phone ?? "Pendiente"}</p>
          {client.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {client.tags.map((tag) => (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-kredo-primary" key={tag.id}>
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={client.status} />
          <Link className="rounded-md border border-kredo-line px-3 py-2 text-sm font-semibold" to={`/clients/${client.id}/edit`}>
            Editar perfil
          </Link>
        </div>
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
            <h2 className="font-semibold text-kredo-ink">Politica de intereses</h2>
            <p className="mt-1 text-sm text-kredo-muted">Los cambios futuros no modifican cargos ya generados.</p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              interestPolicy?.isFrozen
                ? "bg-blue-50 text-kredo-primary ring-1 ring-blue-200"
                : "bg-green-50 text-kredo-green ring-1 ring-green-200"
            }`}
          >
            {interestPolicy?.isFrozen ? "Congelados" : "Activos"}
          </span>
        </div>

        {interestPolicyLoading ? <p className="mt-3 text-sm text-kredo-muted">Cargando politica...</p> : null}
        {interestPolicyError ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">
            No se pudo cargar la politica de intereses.
          </p>
        ) : null}

        {!interestPolicyLoading && !interestPolicyError ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-kredo-surface p-3">
              <dt className="text-kredo-muted">Tasa vigente</dt>
              <dd className="mt-1 font-semibold">
                {interestPolicy?.hasMixedRates
                  ? "Varias tasas"
                  : interestPolicy?.currentRateBps != null
                    ? `${(interestPolicy.currentRateBps / 100).toFixed(2)}%`
                    : "Sin prestamos"}
              </dd>
            </div>
            <div className="rounded-md bg-kredo-surface p-3">
              <dt className="text-kredo-muted">Proximo cambio</dt>
              <dd className="mt-1 font-semibold">
                {interestPolicy?.pendingRateBps != null
                  ? `${(interestPolicy.pendingRateBps / 100).toFixed(2)}% el ${interestPolicy.pendingRateEffectiveDate}`
                  : interestPolicy?.isFrozen
                    ? `Desde ${interestPolicy.frozenSince}`
                    : "Ninguno"}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className="min-h-11 rounded-md border border-kredo-line bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={interestPolicyLoading || Boolean(interestPolicyError)}
            onClick={() => openPolicyAction("rate")}
            type="button"
          >
            Cambiar interes
          </button>
          <button
            className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${
              interestPolicy?.isFrozen
                ? "bg-kredo-green text-white"
                : "border border-blue-200 bg-blue-50 text-kredo-primary"
            }`}
            disabled={interestPolicyLoading || Boolean(interestPolicyError)}
            onClick={() => openPolicyAction(interestPolicy?.isFrozen ? "resume" : "freeze")}
            type="button"
          >
            {interestPolicy?.isFrozen ? "Reactivar intereses" : "Congelar intereses"}
          </button>
        </div>

        {(interestPolicy?.recentEvents.length ?? 0) > 0 ? (
          <div className="mt-4 border-t border-kredo-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-kredo-muted">Cambios recientes</p>
            <div className="mt-2 space-y-2">
              {interestPolicy?.recentEvents.map((event) => (
                <div className="flex items-start justify-between gap-3 text-sm" key={event.id}>
                  <div>
                    <p className="font-medium">
                      {event.type === "freeze"
                        ? "Intereses congelados"
                        : event.type === "resume"
                          ? "Intereses reactivados"
                          : `Tasa cambiada a ${((event.rateBps ?? 0) / 100).toFixed(2)}%`}
                    </p>
                    <p className="text-xs text-kredo-muted">{event.reason}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-kredo-muted">{event.date}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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

        {generateInterestMutation.isPending ? <p className="mt-3 text-sm font-medium text-kredo-primary">Generando intereses vencidos...</p> : null}

        <button
          className="mt-3 min-h-11 w-full rounded-md border border-kredo-primary bg-white px-4 py-2 font-semibold text-kredo-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={generateInterestMutation.isPending || interestPolicy?.isFrozen}
          onClick={() => {
            setInterestMessage("");
            generateInterestMutation.mutate();
          }}
          type="button"
        >
          {generateInterestMutation.isPending
            ? "Generando cargos..."
            : interestPolicy?.isFrozen
              ? "Intereses congelados"
              : "Generar cargos"}
        </button>

        {interestMessage ? <p className="mt-2 text-sm font-medium text-kredo-green">{interestMessage}</p> : null}

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
        <Link className="min-h-12 rounded-md border border-kredo-line bg-white px-3 py-3 text-center font-semibold" to={`/payments/new?clientId=${client.id}`}>
          Registrar pago
        </Link>
        <Link className="col-span-2 min-h-12 rounded-md border border-kredo-line bg-white px-3 py-3 text-center font-semibold" to={`/clients/${client.id}/statement`}>
          Estado de cuenta
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

      {policyAction ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/30 px-4 pb-4">
          <section className="w-full rounded-lg border border-kredo-line bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold">
              {policyAction === "rate"
                ? "Cambiar interes"
                : policyAction === "freeze"
                  ? "Congelar intereses"
                  : "Reactivar intereses"}
            </h2>
            <p className="mt-2 text-sm text-kredo-muted">
              {policyAction === "rate"
                ? "La nueva tasa se aplicara desde el proximo cargo pendiente. Los cargos anteriores no cambiaran."
                : policyAction === "freeze"
                  ? "No se generaran cargos nuevos desde hoy. El capital y los intereses ya generados permaneceran pendientes."
                  : "Los intereses comenzaran nuevamente en el siguiente cierre, sin cobrar los ciclos que estuvieron congelados."}
            </p>

            {policyAction === "rate" ? (
              <label className="mt-4 block">
                <span className="text-sm font-medium text-kredo-ink">Nuevo interes (%)</span>
                <input
                  className="mt-2 min-h-12 w-full rounded-md border border-kredo-line bg-white px-3 py-3 text-base outline-none focus:border-kredo-primary"
                  inputMode="decimal"
                  max="100"
                  min="0"
                  onChange={(event) => setNewInterestRate(event.target.value)}
                  placeholder="Ejemplo: 10"
                  step="0.01"
                  type="number"
                  value={newInterestRate}
                />
              </label>
            ) : null}

            <label className="mt-4 block">
              <span className="text-sm font-medium text-kredo-ink">Motivo</span>
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-kredo-line bg-white px-3 py-3 text-base outline-none focus:border-kredo-primary"
                onChange={(event) => setPolicyReason(event.target.value)}
                placeholder={
                  policyAction === "rate"
                    ? "Ejemplo: nueva condicion acordada con el cliente"
                    : policyAction === "freeze"
                      ? "Ejemplo: acuerdo temporal de pago"
                      : "Ejemplo: finalizo el acuerdo temporal"
                }
                value={policyReason}
              />
            </label>

            {policyError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">{policyError}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="min-h-12 rounded-md border border-kredo-line bg-white px-4 py-3 font-semibold"
                disabled={policyMutation.isPending}
                onClick={() => {
                  setPolicyAction(null);
                  setPolicyError("");
                }}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={`min-h-12 rounded-md px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  policyAction === "freeze" ? "bg-kredo-primary" : "bg-kredo-green"
                }`}
                disabled={policyMutation.isPending}
                onClick={handlePolicyConfirm}
                type="button"
              >
                {policyMutation.isPending
                  ? "Guardando..."
                  : policyAction === "rate"
                    ? "Guardar nueva tasa"
                    : policyAction === "freeze"
                      ? "Confirmar congelamiento"
                      : "Confirmar reactivacion"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
