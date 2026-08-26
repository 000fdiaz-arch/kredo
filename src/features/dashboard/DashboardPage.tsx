import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CalendarRange, ChevronDown, ChevronRight, HandCoins, TrendingUp, Wallet, X } from "lucide-react";
import { MetricDetailsModal, type MetricDetail } from "@/components/ui/MetricDetailsModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrganization } from "@/features/organizations/OrganizationProvider";
import { toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getDashboardSummary } from "@/services/dashboard.service";
import {
  createProfitWithdrawal,
  listCycleProfitSummaries,
  type CycleProfitSummary,
} from "@/services/financial-movements.service";

type DashboardData = Awaited<ReturnType<typeof getDashboardSummary>>;
type MetricKey = "total" | "lent" | "cash" | "profit" | "projection";

type AnimatedMoneyProps = {
  className: string;
  value: number;
};

function AnimatedMoney({ className, value }: AnimatedMoneyProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    const duration = 700;
    const startedAt = performance.now();
    let animationFrame = 0;

    const update = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * easedProgress));

      if (progress < 1) animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  return <p className={className}>{formatMoney(displayValue)}</p>;
}

function buildMetricDetail(metric: MetricKey, data: DashboardData): MetricDetail {
  if (metric === "total") {
    return {
      title: "Dinero total",
      value: formatMoney(data.retainedEquityCents),
      description: "Es todo el dinero de Kredo, esté disponible o prestado a clientes.",
      formula: "Dinero prestado + dinero en caja",
      rows: [
        { label: "Dinero prestado", value: formatMoney(data.capitalLentCents) },
        { label: "+ Dinero en caja", value: formatMoney(data.availableCashCents) },
        { label: "= Dinero total", value: formatMoney(data.retainedEquityCents) },
      ],
    };
  }

  if (metric === "lent") {
    const clientRows = data.clients
      .filter((client) => (client.balance?.principal_balance_cents ?? 0) > 0)
      .map((client) => ({
        label: client.full_name,
        value: formatMoney(client.balance?.principal_balance_cents ?? 0),
      }));

    return {
      title: "Dinero prestado",
      value: formatMoney(data.capitalLentCents),
      description: "Es el capital que los clientes todavía deben. No incluye intereses.",
      formula: "Suma del capital pendiente de todos los clientes",
      rows: clientRows.length > 0 ? clientRows : [{ label: "Capital pendiente", value: formatMoney(0) }],
      action: { label: "Ver clientes", to: "/clients" },
    };
  }

  if (metric === "profit") {
    return {
      title: "Ganancia del ciclo",
      value: formatMoney(data.cycleNetProfitCents),
      description: `Es la ganancia obtenida del ${data.cyclePaymentStartDate} al ${data.cyclePaymentEndDate}.`,
      formula: "Intereses + mora - gastos - pérdidas",
      rows: [
        { label: "+ Intereses cobrados", value: formatMoney(data.cycleInterestCollectedCents) },
        { label: "+ Mora cobrada", value: formatMoney(data.cycleLateFeeIncomeCents) },
        { label: "- Gastos", value: formatMoney(data.cycleExpensesCents) },
        { label: "- Pérdidas", value: formatMoney(data.cycleLoanLossCents) },
        { label: "= Ganancia del ciclo", value: formatMoney(data.cycleNetProfitCents) },
      ],
      note: data.cycleProfitWithdrawnCents > 0
        ? `Durante este ciclo se registraron retiros de utilidad por ${formatMoney(data.cycleProfitWithdrawnCents)}.`
        : "Durante este ciclo no se registraron retiros de utilidad.",
    };
  }

  if (metric === "projection") {
    const clientRows = data.projectedClients.map((client) => ({
      label: client.fullName,
      value: formatMoney(client.interestAmountCents),
    }));

    return {
      title: "Ganancia bruta estimada",
      value: formatMoney(data.projectedGrossProfitCents),
      description: `Es el interés que generarían los saldos actuales en el cierre del ${data.projectedProfitEndDate}.`,
      formula: "Capital pendiente de cada préstamo × tasa aplicable",
      rows: clientRows.length > 0 ? clientRows : [{ label: "Interés proyectado", value: formatMoney(0) }],
      note: "Es una estimación bruta. Puede cambiar con pagos, préstamos nuevos, cambios de tasa o intereses congelados; no descuenta gastos ni pérdidas futuras.",
      action: { label: "Ver clientes", to: "/clients" },
    };
  }

  return {
    title: "Dinero en caja",
    value: formatMoney(data.availableCashCents),
    description: "Es el dinero disponible después de registrar todas las entradas y salidas.",
    formula: "Entradas de dinero - salidas de dinero",
    rows: [
      { label: "+ Aportes de capital", value: formatMoney(data.capitalContributedCents) },
      { label: "+ Capital recuperado", value: formatMoney(data.principalRecoveredCents) },
      { label: "+ Intereses cobrados", value: formatMoney(data.interestCollectedCents) },
      { label: "+ Mora cobrada", value: formatMoney(data.lateFeeIncomeCents) },
      { label: "- Préstamos entregados", value: formatMoney(data.historicalLoanVolumeCents) },
      { label: "- Capital retirado", value: formatMoney(data.capitalWithdrawnCents) },
      { label: "- Gastos", value: formatMoney(data.expensesCents) },
      { label: "= Dinero en caja", value: formatMoney(data.availableCashCents) },
    ],
    action: { label: "Ver movimientos", to: "/history" },
  };
}

type ProfitWithdrawalModalProps = {
  accumulatedProfitCents: number;
  availableCents: number;
  cashCents: number;
  cycles: CycleProfitSummary[];
  cyclesError: boolean;
  cyclesLoading: boolean;
  errorMessage?: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (amountCents: number) => void;
  withdrawnCents: number;
};

function ProfitWithdrawalModal({ accumulatedProfitCents, availableCents, cashCents, cycles, cyclesError, cyclesLoading, errorMessage, isPending, onClose, onSubmit, withdrawnCents }: ProfitWithdrawalModalProps) {
  const [amount, setAmount] = useState("");
  const amountCents = Math.round(Number(amount || "0") * 100);
  const invalidAmount = !Number.isFinite(amountCents) || amountCents <= 0 || amountCents > availableCents;
  const remainingProfitCents = Math.max(accumulatedProfitCents - withdrawnCents, 0);
  const projectedProfitCents = remainingProfitCents - (Number.isFinite(amountCents) ? amountCents : 0);
  const projectedCashCents = cashCents - (Number.isFinite(amountCents) ? amountCents : 0);
  const setPercentage = (percentage: number) => {
    setAmount((Math.round(availableCents * percentage) / 100).toFixed(2));
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPending, onClose]);

  return (
    <div
      aria-label="Retirar utilidad"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
      onClick={() => { if (!isPending) onClose(); }}
      role="dialog"
    >
      <form
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalidAmount) onSubmit(amountCents);
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-kredo-primary">Ganancia acumulada</p>
            <h2 className="mt-1 text-xl font-bold text-kredo-ink">Retirar utilidad acumulada</h2>
          </div>
          <button aria-label="Cerrar" className="rounded-md border border-kredo-line p-2" disabled={isPending} onClick={onClose} type="button">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <dl className="mt-5 divide-y divide-emerald-100 rounded-xl bg-emerald-50 px-4 text-sm">
          <div className="flex justify-between gap-4 py-3"><dt className="text-kredo-muted">Ganancia generada</dt><dd className="font-semibold">{formatMoney(accumulatedProfitCents)}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className="text-kredo-muted">- Utilidad retirada</dt><dd className="font-semibold">{formatMoney(withdrawnCents)}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className="text-kredo-muted">Caja disponible</dt><dd className="font-semibold">{formatMoney(cashCents)}</dd></div>
        </dl>
        <div className="mt-3 rounded-xl bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-kredo-muted">Disponible para retirar</p>
          <p className="mt-1 text-2xl font-bold text-kredo-green">{formatMoney(availableCents)}</p>
        </div>

        {availableCents > 0 ? (
          <label className="mt-5 block">
            <span className="text-sm font-medium text-kredo-ink">Monto a retirar</span>
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                className="min-h-12 min-w-0 flex-1 rounded-md border border-kredo-line px-3 text-base outline-none focus:border-kredo-primary"
                max={(availableCents / 100).toFixed(2)}
                min="0.01"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={amount}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button className="min-h-10 rounded-md border border-kredo-line text-sm font-semibold text-kredo-primary" onClick={() => setPercentage(0.25)} type="button">25%</button>
              <button className="min-h-10 rounded-md border border-kredo-line text-sm font-semibold text-kredo-primary" onClick={() => setPercentage(0.5)} type="button">50%</button>
              <button className="min-h-10 rounded-md border border-kredo-line text-sm font-semibold text-kredo-primary" onClick={() => setPercentage(1)} type="button">Todo</button>
            </div>
            {amountCents > availableCents ? <span className="mt-2 block text-sm text-kredo-red">El monto supera la utilidad disponible.</span> : null}
          </label>
        ) : (
          <p className="mt-5 text-sm leading-6 text-kredo-muted">No hay ganancia acumulada disponible en caja para retirar.</p>
        )}

        {errorMessage ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-medium text-kredo-red">{errorMessage}</p> : null}

        <div className="mt-5 rounded-xl border border-kredo-line p-4">
          <p className="text-sm font-bold text-kredo-ink">Después del retiro</p>
          <dl className="mt-2 divide-y divide-kredo-line text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-kredo-muted">Ganancia que quedaría</dt>
              <dd className={`font-bold ${projectedProfitCents < 0 ? "text-kredo-red" : "text-kredo-ink"}`}>{formatMoney(projectedProfitCents)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-kredo-muted">Caja que quedaría</dt>
              <dd className={`font-bold ${projectedCashCents < 0 ? "text-kredo-red" : "text-kredo-ink"}`}>{formatMoney(projectedCashCents)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-kredo-ink">Ganancia de cada período</p>
          <p className="mt-1 text-xs text-kredo-muted">Estos períodos forman la ganancia acumulada.</p>
          {cyclesLoading ? <p className="mt-3 rounded-lg bg-kredo-surface p-3 text-sm text-kredo-muted">Cargando períodos...</p> : null}
          {cyclesError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-kredo-red">No se pudieron cargar los períodos.</p> : null}
          <div className="mt-3 divide-y divide-kredo-line overflow-hidden rounded-lg border border-kredo-line">
            {cycles.map((cycle) => (
              <div className="flex items-center justify-between gap-4 bg-white p-3" key={cycle.startDate}>
                <div>
                  <p className="text-sm font-medium text-kredo-ink">{cycle.startDate} al {cycle.endDate}</p>
                  <p className="mt-0.5 text-xs text-kredo-muted">Ganancia neta</p>
                </div>
                <p className={`text-sm font-bold ${cycle.netProfitCents < 0 ? "text-kredo-red" : "text-kredo-green"}`}>{formatMoney(cycle.netProfitCents)}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          className="mt-5 min-h-12 w-full rounded-md bg-kredo-primary px-4 font-semibold text-white disabled:opacity-50"
          disabled={invalidAmount || isPending || availableCents <= 0}
          type="submit"
        >
          {isPending ? "Registrando retiro..." : "Confirmar retiro"}
        </button>
      </form>
    </div>
  );
}

type CycleHistoryModalProps = {
  currentStartDate: string;
  cycles: CycleProfitSummary[];
  error: boolean;
  isLoading: boolean;
  onClose: () => void;
};

function CycleHistoryModal({ currentStartDate, cycles, error, isLoading, onClose }: CycleHistoryModalProps) {
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      aria-label="Ganancia por ciclo"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
    >
      <article className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-kredo-primary">Historial</p>
            <h2 className="mt-1 text-xl font-bold text-kredo-ink">Ganancia por ciclo</h2>
          </div>
          <button aria-label="Cerrar historial" className="rounded-md border border-kredo-line p-2" onClick={onClose} type="button">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {isLoading ? <p className="mt-5 rounded-lg bg-kredo-surface p-4 text-sm text-kredo-muted">Cargando ciclos...</p> : null}
        {error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-kredo-red">No se pudieron cargar los ciclos.</p> : null}

        <div className="mt-5 space-y-3">
          {cycles.map((cycle) => {
            const isExpanded = expandedCycle === cycle.startDate;
            const isCurrent = cycle.startDate === currentStartDate;

            return (
              <div className="overflow-hidden rounded-xl border border-kredo-line" key={cycle.startDate}>
                <button
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between gap-4 bg-white p-4 text-left"
                  onClick={() => setExpandedCycle(isExpanded ? null : cycle.startDate)}
                  type="button"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-kredo-ink">{cycle.startDate} al {cycle.endDate}</p>
                      {isCurrent ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-kredo-primary">Actual</span> : null}
                    </div>
                    <p className={`mt-1 text-xl font-bold ${cycle.netProfitCents < 0 ? "text-kredo-red" : "text-kredo-green"}`}>
                      {formatMoney(cycle.netProfitCents)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-kredo-primary">
                      {isExpanded ? "Ocultar desglose" : "Ver desglose"}
                    </p>
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-kredo-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>

                {isExpanded ? (
                  <div className="border-t border-kredo-line bg-kredo-surface p-4">
                    <p className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-kredo-ink">
                      Intereses + mora - gastos - pérdidas
                    </p>
                    <dl className="mt-3 divide-y divide-kredo-line rounded-lg border border-kredo-line bg-white px-3 text-sm">
                      <div className="flex justify-between gap-4 py-3"><dt className="text-kredo-muted">+ Intereses cobrados</dt><dd className="font-semibold">{formatMoney(cycle.interestCollectedCents)}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-kredo-muted">+ Mora cobrada</dt><dd className="font-semibold">{formatMoney(cycle.lateFeeIncomeCents)}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-kredo-muted">- Gastos</dt><dd className="font-semibold">{formatMoney(cycle.expensesCents)}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-kredo-muted">- Pérdidas</dt><dd className="font-semibold">{formatMoney(cycle.loanLossCents)}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="font-semibold text-kredo-ink">= Ganancia neta</dt><dd className={`font-bold ${cycle.netProfitCents < 0 ? "text-kredo-red" : "text-kredo-green"}`}>{formatMoney(cycle.netProfitCents)}</dd></div>
                    </dl>
                    <dl className="mt-3 divide-y divide-kredo-line rounded-lg border border-kredo-line bg-white px-3 text-sm">
                      <div className="flex justify-between gap-4 py-3"><dt className="text-kredo-muted">Retiros realizados en este ciclo</dt><dd className="font-semibold">{formatMoney(cycle.profitWithdrawnCents)}</dd></div>
                    </dl>

                    <div className="mt-4">
                      <p className="text-sm font-bold text-kredo-ink">De dónde sale este monto</p>
                      <p className="mt-1 text-xs text-kredo-muted">Cada cobro suma; cada gasto o pérdida resta.</p>
                      <div className="mt-3 divide-y divide-kredo-line overflow-hidden rounded-lg border border-kredo-line bg-white">
                        {cycle.sources.map((source) => (
                          <div className="flex items-center justify-between gap-4 p-3" key={source.id}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-kredo-ink">{source.label}</p>
                              <p className="mt-0.5 text-xs text-kredo-muted">{source.date}</p>
                            </div>
                            <p className={`shrink-0 text-sm font-bold ${source.direction === "income" ? "text-kredo-green" : "text-kredo-red"}`}>
                              {source.direction === "income" ? "+" : "-"}{formatMoney(source.amountCents)}
                            </p>
                          </div>
                        ))}
                        {cycle.sources.length === 0 ? (
                          <p className="p-3 text-sm text-kredo-muted">No hubo movimientos de ganancia en este ciclo.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [cycleHistoryOpen, setCycleHistoryOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["dashboard-summary", organizationId],
    queryFn: () => getDashboardSummary(organizationId ?? undefined),
  });
  const cycleHistoryQuery = useQuery({
    enabled: cycleHistoryOpen || withdrawalOpen,
    queryKey: ["cycle-profit-history"],
    queryFn: listCycleProfitSummaries,
  });
  const positiveCashCents = Math.max(data?.availableCashCents ?? 0, 0);
  const positiveLentCents = Math.max(data?.capitalLentCents ?? 0, 0);
  const distributionTotalCents = positiveCashCents + positiveLentCents;
  const lentPercent = distributionTotalCents > 0 ? (positiveLentCents / distributionTotalCents) * 100 : 0;
  const cashPercent = distributionTotalCents > 0 ? 100 - lentPercent : 0;
  const remainingAccumulatedProfitCents = Math.max((data?.netProfitCents ?? 0) - (data?.totalProfitWithdrawnCents ?? 0), 0);
  const withdrawableProfitCents = Math.min(remainingAccumulatedProfitCents, positiveCashCents);
  const withdrawalMutation = useMutation({
    mutationFn: (amountCents: number) => {
      if (!user || !organizationId) throw new Error("No se pudo identificar la empresa.");

      return createProfitWithdrawal({
        userId: user.id,
        organizationId,
        movementDate: toDateInputValue(),
        amountCents,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["available-cash", organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["report-data"] }),
        queryClient.invalidateQueries({ queryKey: ["cycle-profit-history"] }),
      ]);
      setWithdrawalOpen(false);
    },
  });

  return (
    <section>
      <PageHeader eyebrow="Inicio" title="Tu dinero" />

      {isLoading ? (
        <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">
          Cargando...
        </article>
      ) : null}

      {error ? (
        <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">
          No se pudo cargar la información. Refresca la página e intenta nuevamente.
        </article>
      ) : null}

      {data ? (
        <div className="space-y-3">
          <button
            aria-label="Ver cómo se calcula el dinero total"
            className="kredo-rise relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#1463ff] to-[#083da5] p-6 text-left text-white shadow-soft transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-kredo-primary focus:ring-offset-2"
            onClick={() => setSelectedMetric("total")}
            type="button"
          >
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
            <div className="absolute -bottom-16 right-12 h-32 w-32 rounded-full bg-white/5" aria-hidden="true" />
            <div className="relative">
              <div className="mb-7 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Wallet className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-blue-100">Dinero total</p>
              <AnimatedMoney className="mt-2 text-4xl font-bold tracking-tight" value={data.retainedEquityCents} />

              <div className="mt-7">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-blue-100">
                  <span>Prestado</span>
                  <span>En caja</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="kredo-bar bg-amber-300"
                    style={{ width: `${lentPercent}%` }}
                    title={`Prestado: ${formatMoney(data.capitalLentCents)}`}
                  />
                  <div
                    className="kredo-bar bg-emerald-300"
                    style={{ width: `${cashPercent}%` }}
                    title={`En caja: ${formatMoney(data.availableCashCents)}`}
                  />
                </div>
              </div>
              <p className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-blue-100">
                Ver cómo se calcula <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </p>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              aria-label="Ver cómo se calcula el dinero prestado"
              className="kredo-rise kredo-rise-delay-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-kredo-primary"
              onClick={() => setSelectedMetric("lent")}
              type="button"
            >
              <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-kredo-yellow">
                <HandCoins className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-kredo-muted">Dinero prestado</p>
              <AnimatedMoney className="mt-2 break-words text-xl font-bold tracking-tight text-kredo-ink sm:text-2xl" value={data.capitalLentCents} />
              <p className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-kredo-primary">
                Ver cálculo <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </p>
            </button>

            <button
              aria-label="Ver cómo se calcula el dinero en caja"
              className={`kredo-rise kredo-rise-delay-2 rounded-2xl border p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-kredo-primary ${data.availableCashCents < 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
              onClick={() => setSelectedMetric("cash")}
              type="button"
            >
              <div className={`mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl ${data.availableCashCents < 0 ? "bg-red-100 text-kredo-red" : "bg-emerald-100 text-kredo-green"}`}>
                <Banknote className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-kredo-muted">Dinero en caja</p>
              <AnimatedMoney className="mt-2 break-words text-xl font-bold tracking-tight text-kredo-ink sm:text-2xl" value={data.availableCashCents} />
              <p className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-kredo-primary">
                Ver cálculo <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </p>
            </button>
          </div>

          <article className="kredo-rise kredo-rise-delay-2 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <TrendingUp className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-kredo-muted">Ganancia del ciclo</p>
                <AnimatedMoney className={`mt-2 text-3xl font-bold tracking-tight ${data.cycleNetProfitCents < 0 ? "text-kredo-red" : "text-kredo-ink"}`} value={data.cycleNetProfitCents} />
                <p className="mt-1 text-xs text-kredo-muted">{data.cyclePaymentStartDate} al {data.cyclePaymentEndDate}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-violet-200 bg-white px-3 text-sm font-semibold text-violet-700"
                onClick={() => setSelectedMetric("profit")}
                type="button"
              >
                Ver cálculo <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                className="min-h-11 rounded-md bg-violet-700 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  withdrawalMutation.reset();
                  setWithdrawalOpen(true);
                }}
                type="button"
              >
                Retirar utilidad
              </button>
            </div>
            <p className="mt-3 text-xs text-kredo-muted">
              Disponible de la ganancia acumulada: <span className="font-semibold text-kredo-ink">{formatMoney(withdrawableProfitCents)}</span>
            </p>
            <button
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-violet-700 hover:bg-violet-50"
              onClick={() => setCycleHistoryOpen(true)}
              type="button"
            >
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              Ver todos los ciclos
            </button>
            {remainingAccumulatedProfitCents > 0 && withdrawableProfitCents <= 0 ? (
              <p className="mt-3 text-xs text-kredo-muted">La utilidad existe, pero todavía no está disponible en caja.</p>
            ) : null}
          </article>

          <button
            aria-label="Ver cómo se calcula la ganancia estimada del próximo ciclo"
            className="kredo-rise kredo-rise-delay-2 w-full rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 text-left transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-kredo-primary"
            onClick={() => setSelectedMetric("projection")}
            type="button"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <TrendingUp className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-kredo-muted">Ganancia bruta estimada</p>
                <AnimatedMoney className="mt-2 text-3xl font-bold tracking-tight text-kredo-ink" value={data.projectedGrossProfitCents} />
                <p className="mt-1 text-xs text-kredo-muted">Próximo cierre: {data.projectedProfitEndDate}</p>
              </div>
              <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
            </div>
            <p className="mt-4 text-xs leading-5 text-kredo-muted">
              Proyección de intereses con los saldos y tasas actuales. No incluye gastos futuros.
            </p>
          </button>
        </div>
      ) : null}

      {data && selectedMetric ? (
        <MetricDetailsModal detail={buildMetricDetail(selectedMetric, data)} onClose={() => setSelectedMetric(null)} />
      ) : null}

      {withdrawalOpen ? (
        <ProfitWithdrawalModal
          accumulatedProfitCents={data?.netProfitCents ?? 0}
          availableCents={withdrawableProfitCents}
          cashCents={data?.availableCashCents ?? 0}
          cycles={cycleHistoryQuery.data ?? []}
          cyclesError={cycleHistoryQuery.isError}
          cyclesLoading={cycleHistoryQuery.isLoading}
          errorMessage={withdrawalMutation.error instanceof Error ? withdrawalMutation.error.message : undefined}
          isPending={withdrawalMutation.isPending}
          onClose={() => setWithdrawalOpen(false)}
          onSubmit={(amountCents) => withdrawalMutation.mutate(amountCents)}
          withdrawnCents={data?.totalProfitWithdrawnCents ?? 0}
        />
      ) : null}

      {cycleHistoryOpen && data ? (
        <CycleHistoryModal
          currentStartDate={data.cyclePaymentStartDate}
          cycles={cycleHistoryQuery.data ?? []}
          error={cycleHistoryQuery.isError}
          isLoading={cycleHistoryQuery.isLoading}
          onClose={() => setCycleHistoryOpen(false)}
        />
      ) : null}
    </section>
  );
}
