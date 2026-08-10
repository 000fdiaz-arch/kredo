import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/MetricCard";
import { MetricDetailsModal, type MetricDetail } from "@/components/ui/MetricDetailsModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/money";
import { getDashboardSummary } from "@/services/dashboard.service";
import { calculateLendingLimitGuidance } from "@/services/lending-limits";
import { createCapitalContribution } from "@/services/financial-movements.service";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrganization } from "@/features/organizations/OrganizationProvider";
import { toDateInputValue } from "@/lib/dates";

function formatRatio(value: number) {
  return `${value.toFixed(2)}x`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

type SummaryTab = "operation" | "capital" | "profit" | "activity";
type MetricKey =
  | "availableCash"
  | "lendingLimit"
  | "capitalLent"
  | "activeClients"
  | "nextClose"
  | "capitalContributed"
  | "capitalWithdrawn"
  | "totalPortfolio"
  | "capitalRotation"
  | "interestCollected"
  | "netProfit"
  | "interestGenerated"
  | "pendingInterest"
  | "cyclePayments"
  | "cyclePrincipal"
  | "cycleLoans"
  | "historicalLoans";

type DashboardData = Awaited<ReturnType<typeof getDashboardSummary>>;

function clientBalanceRows(data: DashboardData | undefined, field: "principal_balance_cents" | "interest_balance_cents") {
  return (data?.clients ?? [])
    .filter((client) => (client.balance?.[field] ?? 0) > 0)
    .map((client) => ({ label: client.full_name, value: formatMoney(client.balance?.[field] ?? 0) }));
}

function buildMetricDetail(key: MetricKey, data: DashboardData | undefined): MetricDetail {
  const money = (value?: number) => formatMoney(value ?? 0);
  const availableCashCents = data?.availableCashCents ?? 0;
  const guidance = calculateLendingLimitGuidance(availableCashCents, 0);

  switch (key) {
    case "availableCash":
      return {
        title: "Dinero disponible",
        value: money(availableCashCents),
        description: "Es el efectivo que queda sin prestar despues de sumar todas las entradas y restar todas las salidas.",
        formula: "Aportes + capital recuperado + intereses + mora - prestamos - retiros - gastos",
        rows: [
          { label: "+ Aportes de capital", value: money(data?.capitalContributedCents) },
          { label: "+ Capital recuperado", value: money(data?.principalRecoveredCents) },
          { label: "+ Intereses cobrados", value: money(data?.interestCollectedCents) },
          { label: "+ Mora cobrada", value: money(data?.lateFeeIncomeCents) },
          { label: "- Prestamos desembolsados", value: money(data?.historicalLoanVolumeCents) },
          { label: "- Capital retirado", value: money(data?.capitalWithdrawnCents) },
          { label: "- Gastos", value: money(data?.expensesCents) },
        ],
        note: "El resultado de estas entradas y salidas es el dinero disponible mostrado arriba.",
        action: { label: "Ver historial de movimientos", to: "/history" },
      };
    case "lendingLimit":
      return {
        title: "Limite por persona",
        value: availableCashCents < 0 ? "No disponible" : money(guidance.recommendedLimitCents),
        description: "Es una guia para evitar concentrar demasiado dinero en una sola persona.",
        formula: "Limite recomendado = 15% del dinero disponible",
        rows: [
          { label: "Dinero disponible", value: money(availableCashCents) },
          { label: "Normal (10%)", value: money(guidance.normalLimitCents) },
          { label: "Recomendado (15%)", value: money(guidance.recommendedLimitCents) },
          { label: "Excepcion (20%)", value: money(guidance.exceptionalLimitCents) },
        ],
      };
    case "capitalLent":
      return {
        title: "Dinero actualmente prestado",
        value: money(data?.capitalLentCents),
        description: "Es el capital que los clientes todavia deben. No incluye los intereses pendientes.",
        formula: "Suma del capital pendiente de todos los clientes",
        rows: clientBalanceRows(data, "principal_balance_cents"),
        note: "Cada pago aplicado a capital reduce este total.",
        action: { label: "Ver cartera por cliente", to: "/clients" },
      };
    case "activeClients": {
      const clients = data?.clients ?? [];
      return {
        title: "Clientes activos",
        value: `${data?.activeClientCount ?? 0}`,
        description: "Clientes habilitados para operar, tengan o no un saldo pendiente.",
        rows: [
          { label: "Al corriente", value: `${clients.filter((client) => client.status === "current").length}` },
          { label: "Interes pendiente", value: `${clients.filter((client) => client.status === "interest_pending").length}` },
          { label: "Con atraso", value: `${data?.lateClientCount ?? 0}` },
          { label: "Sin movimientos", value: `${clients.filter((client) => client.status === "no_movements").length}` },
        ],
        action: { label: "Ver clientes", to: "/clients" },
      };
    }
    case "nextClose":
      return {
        title: "Proximo cierre",
        value: data?.nextCloseDate ?? "Cargando",
        description: "Fecha en que termina el ciclo actual y se revisan pagos, saldos e intereses.",
        rows: [
          { label: "Inicio del ciclo", value: data?.cyclePaymentStartDate ?? "-" },
          { label: "Fin del ciclo", value: data?.cyclePaymentEndDate ?? "-" },
          { label: "Proximo cierre", value: data?.nextCloseDate ?? "-" },
        ],
        action: { label: "Ver ciclos", to: "/cycles" },
      };
    case "capitalContributed":
      return {
        title: "Capital propio aportado",
        value: money(data?.capitalContributedCents),
        description: "Todo el dinero que el propietario ha ingresado para financiar la operacion.",
        rows: [
          { label: "Aportes acumulados", value: money(data?.capitalContributedCents) },
          { label: "Retiros acumulados", value: money(data?.capitalWithdrawnCents) },
          { label: "Capital neto aportado", value: money(data?.netContributedCapitalCents) },
        ],
        action: { label: "Ver historial de movimientos", to: "/history" },
      };
    case "capitalWithdrawn":
      return {
        title: "Capital retirado",
        value: money(data?.capitalWithdrawnCents),
        description: "Dinero que el propietario ha sacado de la operacion.",
        rows: [
          { label: "Capital aportado", value: money(data?.capitalContributedCents) },
          { label: "Capital retirado", value: money(data?.capitalWithdrawnCents) },
          { label: "Capital neto aportado", value: money(data?.netContributedCapitalCents) },
        ],
        action: { label: "Ver historial de movimientos", to: "/history" },
      };
    case "totalPortfolio":
      return {
        title: "Total cartera",
        value: money(data?.totalPortfolioCents),
        description: "Todo lo pendiente de cobrar a los clientes, incluyendo capital e intereses.",
        formula: "Capital pendiente + intereses pendientes",
        rows: [
          { label: "Capital pendiente", value: money(data?.capitalLentCents) },
          { label: "Intereses pendientes", value: money(data?.pendingInterestCents) },
        ],
        action: { label: "Ver cartera por cliente", to: "/clients" },
      };
    case "capitalRotation":
      return {
        title: "Rotacion del capital",
        value: formatRatio(data?.cycleCapitalRotation ?? 0),
        description: "Indica cuantas veces el capital neto aportado se ha colocado en prestamos durante el ciclo.",
        formula: "Prestamos del ciclo / capital neto aportado",
        rows: [
          { label: "Prestamos del ciclo", value: money(data?.cycleLoanVolumeCents) },
          { label: "Capital neto aportado", value: money(data?.netContributedCapitalCents) },
        ],
      };
    case "interestCollected":
      return {
        title: "Intereses cobrados",
        value: money(data?.interestCollectedCents),
        description: "Intereses que ya fueron recibidos en pagos reales.",
        rows: [{ label: "Intereses cobrados historicos", value: money(data?.interestCollectedCents) }],
        action: { label: "Ver historial de movimientos", to: "/history" },
      };
    case "netProfit":
      return {
        title: "Ganancia neta",
        value: money(data?.netProfitCents),
        description: "Lo ganado despues de restar gastos y perdidas a los ingresos cobrados.",
        formula: "Intereses + mora - gastos - perdidas",
        rows: [
          { label: "+ Intereses cobrados", value: money(data?.interestCollectedCents) },
          { label: "+ Mora cobrada", value: money(data?.lateFeeIncomeCents) },
          { label: "- Gastos", value: money(data?.expensesCents) },
          { label: "- Perdidas", value: money(data?.loanLossCents) },
        ],
      };
    case "interestGenerated":
      return {
        title: "Interes generado",
        value: money(data?.interestGeneratedCents),
        description: "Interes causado por los prestamos, se haya cobrado o no.",
        rows: [
          { label: "Interes generado", value: money(data?.interestGeneratedCents) },
          { label: "Interes cobrado", value: money(data?.interestCollectedCents) },
          { label: "Interes pendiente actual", value: money(data?.pendingInterestCents) },
        ],
      };
    case "pendingInterest":
      return {
        title: "Interes pendiente",
        value: money(data?.pendingInterestCents),
        description: "Interes generado que los clientes todavia no han pagado.",
        formula: "Suma del interes pendiente de todos los clientes",
        rows: clientBalanceRows(data, "interest_balance_cents"),
        action: { label: "Ver cartera por cliente", to: "/clients" },
      };
    case "cyclePayments":
      return {
        title: "Pagos del ciclo",
        value: money(data?.cyclePaymentsCents),
        description: `Pagos recibidos entre ${data?.cyclePaymentStartDate ?? "-"} y ${data?.cyclePaymentEndDate ?? "-"}.`,
        formula: "Capital recuperado + intereses cobrados",
        rows: [
          { label: "Capital recuperado", value: money(data?.cyclePrincipalRecoveredCents) },
          { label: "Intereses cobrados", value: money(data?.cycleInterestCollectedCents) },
        ],
        action: { label: "Ver pagos del ciclo", to: "/cycles/payments" },
      };
    case "cyclePrincipal":
      return {
        title: "Capital recuperado del ciclo",
        value: money(data?.cyclePrincipalRecoveredCents),
        description: "Parte de los pagos del ciclo que redujo el capital adeudado por los clientes.",
        rows: [
          { label: "Capital recuperado", value: money(data?.cyclePrincipalRecoveredCents) },
          { label: "Intereses cobrados", value: money(data?.cycleInterestCollectedCents) },
          { label: "Pagos totales", value: money(data?.cyclePaymentsCents) },
        ],
        action: { label: "Ver pagos del ciclo", to: "/cycles/payments" },
      };
    case "cycleLoans":
      return {
        title: "Total desembolsado del ciclo",
        value: money(data?.cycleLoanVolumeCents),
        description: "Suma de todos los prestamos entregados durante el ciclo actual, aunque el dinero recuperado se haya vuelto a prestar.",
        rows: [{ label: "Prestamos del ciclo", value: money(data?.cycleLoanVolumeCents) }],
        action: { label: "Ver historial de movimientos", to: "/history" },
      };
    case "historicalLoans":
      return {
        title: "Control historico",
        value: money(data?.historicalLoanVolumeCents),
        description: "Volumen total prestado desde el inicio de los registros.",
        rows: [
          { label: "Total desembolsado", value: money(data?.historicalLoanVolumeCents) },
          { label: "Capital recuperado", value: money(data?.principalRecoveredCents) },
          { label: "Prestamos registrados", value: `${data?.loanCount ?? 0}` },
          { label: "Tasa de recuperacion", value: formatPercent(data?.recoveryRate ?? 0) },
        ],
        action: { label: "Ver historial de movimientos", to: "/history" },
      };
  }
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSummaryTab, setActiveSummaryTab] = useState<SummaryTab>("operation");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const visibleClients = useMemo(() => {
    if (!normalizedSearchTerm) {
      return data?.clients ?? [];
    }

    return (data?.clients ?? []).filter((client) => (
      client.full_name.toLowerCase().includes(normalizedSearchTerm) ||
      client.client_code.toLowerCase().includes(normalizedSearchTerm) ||
      (client.identification ?? "").toLowerCase().includes(normalizedSearchTerm) ||
      (client.phone ?? "").toLowerCase().includes(normalizedSearchTerm)
    ));
  }, [data?.clients, normalizedSearchTerm]);
  const lendingGuidance = calculateLendingLimitGuidance(data?.availableCashCents ?? 0, 0);
  const negativeCashCents = Math.max(-(data?.availableCashCents ?? 0), 0);
  const reconciliationMutation = useMutation({
    mutationFn: async () => {
      if (!user || !organizationId || negativeCashCents <= 0) {
        throw new Error("No hay saldo pendiente por conciliar.");
      }

      return createCapitalContribution({
        userId: user.id,
        organizationId,
        movementDate: toDateInputValue(),
        amountCents: negativeCashCents,
        source: "manual_cash_reconciliation",
        description: "Aporte de capital confirmado para conciliar caja negativa existente.",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["available-cash", organizationId] });
    },
  });
  const summaryTabs: Array<{ id: SummaryTab; label: string }> = [
    { id: "operation", label: "Operacion" },
    { id: "capital", label: "Capital" },
    { id: "profit", label: "Ganancia" },
    { id: "activity", label: "Actividad" },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="Dashboard"
        title="Resumen financiero"
        description="Capital, caja, cartera y ganancia separados por naturaleza."
      />

      <div className="mb-4">
        <div className="grid grid-cols-4 rounded-lg border border-kredo-line bg-white p-1">
          {summaryTabs.map((tab) => (
            <button
              className={`min-h-10 rounded-md px-2 text-xs font-semibold ${
                activeSummaryTab === tab.id ? "bg-kredo-primary text-white" : "text-kredo-muted"
              }`}
              key={tab.id}
              onClick={() => setActiveSummaryTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {activeSummaryTab === "operation" ? (
            <>
              <MetricCard
                label="Dinero disponible"
                value={formatMoney(data?.availableCashCents ?? 0)}
                helper="Caja no prestada, calculada desde movimientos."
                onClick={() => setSelectedMetric("availableCash")}
                tone="green"
              />
              <MetricCard
                label="Limite por persona"
                value={negativeCashCents > 0 ? "No disponible" : formatMoney(lendingGuidance.recommendedLimitCents)}
                helper={negativeCashCents > 0 ? "Primero concilia la caja negativa." : `Normal ${formatMoney(lendingGuidance.normalLimitCents)} - Excepcion ${formatMoney(lendingGuidance.exceptionalLimitCents)}`}
                onClick={() => setSelectedMetric("lendingLimit")}
                tone="yellow"
              />
              <MetricCard
                label="Dinero actualmente prestado"
                value={formatMoney(data?.capitalLentCents ?? 0)}
                helper="Cartera activa: capital pendiente de cobrar."
                onClick={() => setSelectedMetric("capitalLent")}
              />
              <MetricCard label="Clientes activos" value={`${data?.activeClientCount ?? 0}`} helper={`${data?.lateClientCount ?? 0} con atraso`} onClick={() => setSelectedMetric("activeClients")} />
              <MetricCard
                label="Proximo cierre"
                value={data?.nextCloseDate ?? "Cargando"}
                helper={data ? `Ciclo ${data.cyclePaymentStartDate} al ${data.cyclePaymentEndDate}` : "Cargando ciclo actual"}
                onClick={() => setSelectedMetric("nextClose")}
              />
            </>
          ) : null}

          {activeSummaryTab === "capital" ? (
            <>
              <MetricCard
                label="Capital propio aportado"
                value={formatMoney(data?.capitalContributedCents ?? 0)}
                helper="Dinero nuevo colocado por el propietario."
                onClick={() => setSelectedMetric("capitalContributed")}
              />
              <MetricCard label="Capital retirado" value={formatMoney(data?.capitalWithdrawnCents ?? 0)} helper="Retiros hechos por el propietario." onClick={() => setSelectedMetric("capitalWithdrawn")} />
              <MetricCard
                label="Dinero actualmente prestado"
                value={formatMoney(data?.capitalLentCents ?? 0)}
                helper="Cartera activa: capital pendiente de cobrar."
                onClick={() => setSelectedMetric("capitalLent")}
              />
              <MetricCard label="Total cartera" value={formatMoney(data?.totalPortfolioCents ?? 0)} onClick={() => setSelectedMetric("totalPortfolio")} />
              <MetricCard
                label="Rotacion del capital"
                value={formatRatio(data?.cycleCapitalRotation ?? 0)}
                helper="Veces que el capital neto aportado roto en este ciclo."
                onClick={() => setSelectedMetric("capitalRotation")}
              />
            </>
          ) : null}

          {activeSummaryTab === "profit" ? (
            <>
              <MetricCard
                label="Intereses cobrados"
                value={formatMoney(data?.interestCollectedCents ?? 0)}
                helper="Ingresos financieros recibidos en efectivo."
                onClick={() => setSelectedMetric("interestCollected")}
                tone="yellow"
              />
              <MetricCard
                label="Ganancia neta"
                value={formatMoney(data?.netProfitCents ?? 0)}
                helper="Intereses y otros ingresos menos gastos y perdidas."
                onClick={() => setSelectedMetric("netProfit")}
                tone={(data?.netProfitCents ?? 0) < 0 ? "red" : "green"}
              />
              <MetricCard
                label="Interes generado"
                value={formatMoney(data?.interestGeneratedCents ?? 0)}
                helper="Interes causado, aunque no se haya cobrado."
                onClick={() => setSelectedMetric("interestGenerated")}
              />
              <MetricCard label="Interes pendiente" value={formatMoney(data?.pendingInterestCents ?? 0)} onClick={() => setSelectedMetric("pendingInterest")} tone="yellow" />
            </>
          ) : null}

          {activeSummaryTab === "activity" ? (
            <>
              <MetricCard
                label="Pagos del ciclo"
                value={formatMoney(data?.cyclePaymentsCents ?? 0)}
                helper={data ? `Ciclo ${data.cyclePaymentStartDate} al ${data.cyclePaymentEndDate}` : "Cargando ciclo actual"}
                onClick={() => setSelectedMetric("cyclePayments")}
                tone="green"
              />
              <MetricCard
                label="Capital recuperado ciclo"
                value={formatMoney(data?.cyclePrincipalRecoveredCents ?? 0)}
                helper={`Interes cobrado ${formatMoney(data?.cycleInterestCollectedCents ?? 0)}`}
                onClick={() => setSelectedMetric("cyclePrincipal")}
              />
              <MetricCard
                label="Total desembolsado ciclo"
                value={formatMoney(data?.cycleLoanVolumeCents ?? 0)}
                helper="Volumen prestado, incluyendo dinero reutilizado."
                onClick={() => setSelectedMetric("cycleLoans")}
              />
              <MetricCard
                label="Control historico"
                value={formatMoney(data?.historicalLoanVolumeCents ?? 0)}
                helper={`Prestamos ${data?.loanCount ?? 0} - Recuperacion ${formatPercent(data?.recoveryRate ?? 0)}`}
                onClick={() => setSelectedMetric("historicalLoans")}
              />
            </>
          ) : null}
        </div>

        {activeSummaryTab === "operation" && negativeCashCents > 0 ? (
          <article className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
            <p className="font-semibold text-kredo-red">La caja necesita conciliacion</p>
            <p className="mt-1 text-kredo-muted">
              Si los {formatMoney(negativeCashCents)} prestados salieron de dinero aportado por el propietario, registra ese aporte para llevar la caja a cero.
            </p>
            <button
              className="mt-3 min-h-11 rounded-md bg-kredo-primary px-4 py-2 font-semibold text-white disabled:opacity-60"
              disabled={reconciliationMutation.isPending}
              onClick={() => reconciliationMutation.mutate()}
              type="button"
            >
              {reconciliationMutation.isPending ? "Registrando..." : `Registrar aporte de ${formatMoney(negativeCashCents)}`}
            </button>
            {reconciliationMutation.isError ? <p className="mt-2 font-medium text-kredo-red">No se pudo registrar el aporte. Intenta nuevamente.</p> : null}
          </article>
        ) : null}
      </div>

      <div className="mb-4 flex gap-2">
        <label className="flex min-h-12 flex-1 items-center gap-2 rounded-md border border-kredo-line bg-white px-3">
          <Search className="h-5 w-5 text-kredo-muted" aria-hidden="true" />
          <input
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar cliente"
            type="search"
            value={searchTerm}
          />
        </label>
        <Link
          aria-label="Registrar pago"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-kredo-primary px-4 text-sm font-semibold text-white"
          to="/payments/new"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando datos...</article>
      ) : null}

      {error ? (
        <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">
          No se pudieron cargar todos los datos del resumen. Refresca la pagina e intenta nuevamente.
        </article>
      ) : null}

      <div className="space-y-3">
        {visibleClients.map((client) => (
          <article className="rounded-lg border border-kredo-line bg-white p-4" key={client.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-kredo-ink">{client.full_name}</h2>
                <p className="mt-1 text-sm text-kredo-muted">Codigo: {client.client_code}</p>
              </div>
              <StatusBadge status={client.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-kredo-muted">Capital</p>
                <p className="font-semibold">{formatMoney(client.balance?.principal_balance_cents ?? 0)}</p>
              </div>
              <div>
                <p className="text-kredo-muted">Interes</p>
                <p className="font-semibold">{formatMoney(client.balance?.interest_balance_cents ?? 0)}</p>
              </div>
              <div>
                <p className="text-kredo-muted">Total</p>
                <p className="font-semibold">{formatMoney(client.balance?.total_balance_cents ?? 0)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-kredo-primary px-3 text-sm font-semibold text-white"
                to={`/loans/new?clientId=${client.id}`}
              >
                Prestamo
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-kredo-green px-3 text-sm font-semibold text-white"
                to={`/payments/new?clientId=${client.id}`}
              >
                Pago
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-kredo-line px-3 text-sm font-semibold"
                to={`/clients/${client.id}`}
              >
                Detalle
              </Link>
            </div>
          </article>
        ))}

        {!isLoading && !error && (data?.clients.length ?? 0) === 0 ? (
          <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
            Aun no hay clientes registrados en esta empresa.
          </article>
        ) : null}

        {!isLoading && !error && (data?.clients.length ?? 0) > 0 && visibleClients.length === 0 ? (
          <article className="rounded-lg border border-dashed border-kredo-line bg-white p-4 text-sm text-kredo-muted">
            No hay clientes que coincidan con la busqueda.
          </article>
        ) : null}
      </div>

      {selectedMetric ? <MetricDetailsModal detail={buildMetricDetail(selectedMetric, data)} onClose={() => setSelectedMetric(null)} /> : null}
    </section>
  );
}
