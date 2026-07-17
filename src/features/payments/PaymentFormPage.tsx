import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { useAuth } from "@/features/auth/AuthProvider";
import { toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { listClientsWithBalances } from "@/services/clients.service";
import { generateDueInterestForClient } from "@/services/interest.service";
import { createPayment, type PaymentMethod } from "@/services/payments.service";

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Efectivo" },
  { value: "bank_transfer", label: "Transferencia" },
  { value: "yappy", label: "Yappy" },
  { value: "ach", label: "ACH" },
  { value: "other", label: "Otro" },
];

function parseMoneyToCents(value: string) {
  const amount = Number(value || "0");
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

export function PaymentFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [clientId, setClientId] = useState(searchParams.get("clientId") ?? "");
  const [paymentDate, setPaymentDate] = useState(toDateInputValue());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [overpaymentConfirmed, setOverpaymentConfirmed] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [formError, setFormError] = useState("");
  const [isGeneratingInterest, setIsGeneratingInterest] = useState(false);
  const generatedInterestClientIds = useRef(new Set<string>());

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listClientsWithBalances,
  });

  const selectedClient = clients.find((client) => client.id === clientId);
  const totalAmountCents = parseMoneyToCents(amount);
  const interestBalanceCents = selectedClient?.balance?.interest_balance_cents ?? 0;
  const principalBalanceCents = selectedClient?.balance?.principal_balance_cents ?? 0;
  const totalBalanceCents = selectedClient?.balance?.total_balance_cents ?? 0;

  const preview = useMemo(() => {
    const safeTotal = Number.isFinite(totalAmountCents) ? Math.max(totalAmountCents, 0) : 0;
    const interestAmountCents = Math.min(safeTotal, interestBalanceCents);
    const principalAmountCents = Math.min(Math.max(safeTotal - interestAmountCents, 0), principalBalanceCents);
    const unappliedAmountCents = Math.max(safeTotal - interestAmountCents - principalAmountCents, 0);
    const remainingBalanceCents = Math.max(totalBalanceCents - interestAmountCents - principalAmountCents, 0);

    return {
      interestAmountCents,
      principalAmountCents,
      unappliedAmountCents,
      remainingBalanceCents,
      isOverpayment: unappliedAmountCents > 0,
    };
  }, [interestBalanceCents, principalBalanceCents, totalAmountCents, totalBalanceCents]);

  useEffect(() => {
    if (!clientId || generatedInterestClientIds.current.has(clientId)) {
      return;
    }

    let cancelled = false;
    generatedInterestClientIds.current.add(clientId);
    setIsGeneratingInterest(true);

    generateDueInterestForClient(clientId)
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["clients"] }),
          queryClient.invalidateQueries({ queryKey: ["client", clientId] }),
          queryClient.invalidateQueries({ queryKey: ["client-interest-status", clientId] }),
          queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        ]);
      })
      .catch(() => {
        if (!cancelled) {
          setFormError("No se pudieron revisar los intereses vencidos de este cliente.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeneratingInterest(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, queryClient]);

  const mutation = useMutation({
    mutationFn: createPayment,
    onSuccess: async (payment) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["client", payment.client_id] }),
        queryClient.invalidateQueries({ queryKey: ["client-movements", payment.client_id] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      navigate(`/clients/${payment.client_id}`);
    },
    onError: () => {
      setFormError("No se pudo registrar el pago. Revisa la conexion e intenta otra vez.");
      setIsReviewing(false);
    },
  });

  function validateForm() {
    if (!user) {
      return "Debes iniciar sesion para registrar pagos.";
    }

    if (!clientId || !selectedClient) {
      return "Selecciona un cliente.";
    }

    if (!paymentDate) {
      return "Selecciona la fecha del pago.";
    }

    if (!Number.isFinite(totalAmountCents) || totalAmountCents <= 0) {
      return "El monto pagado debe ser mayor que cero.";
    }

    if (totalBalanceCents <= 0) {
      return "Este cliente no tiene saldo pendiente.";
    }

    if (preview.isOverpayment && !overpaymentConfirmed) {
      return "Confirma el sobrepago para continuar.";
    }

    return "";
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();
    setFormError(validationError);

    if (!validationError) {
      setIsReviewing(true);
    }
  }

  function handleConfirm() {
    const validationError = validateForm();
    setFormError(validationError);

    if (validationError || !user) {
      return;
    }

    mutation.mutate({
      userId: user.id,
      clientId,
      paymentDate,
      totalAmountCents,
      interestAmountCents: preview.interestAmountCents,
      principalAmountCents: preview.principalAmountCents,
      paymentMethod,
      referenceNumber,
      notes,
      overpaymentConfirmed: preview.isOverpayment,
    });
  }

  return (
    <section>
      <PageHeader
        eyebrow="Registrar pago"
        title="Nuevo pago"
        description="El pago se aplica primero a interes y luego a capital."
      />

      <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-4" onSubmit={handleReview}>
        <SelectField
          label="Cliente"
          onChange={(event) => {
            setClientId(event.target.value);
            setIsReviewing(false);
            setOverpaymentConfirmed(false);
          }}
          value={clientId}
        >
          <option value="">{isLoading ? "Cargando clientes..." : "Seleccionar cliente"}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.full_name}
            </option>
          ))}
        </SelectField>
        {isGeneratingInterest ? <p className="text-sm font-medium text-kredo-primary">Revisando intereses vencidos...</p> : null}
        <Field label="Fecha" onChange={(event) => setPaymentDate(event.target.value)} type="date" value={paymentDate} />
        <Field
          inputMode="decimal"
          label="Monto pagado"
          min="0"
          onChange={(event) => {
            setAmount(event.target.value);
            setIsReviewing(false);
            setOverpaymentConfirmed(false);
          }}
          placeholder="0.00"
          step="0.01"
          type="number"
          value={amount}
        />
        <SelectField label="Metodo de pago" onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} value={paymentMethod}>
          {paymentMethods.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </SelectField>
        <Field label="Numero de referencia" onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Opcional" value={referenceNumber} />
        <label className="block">
          <span className="text-sm font-medium text-kredo-ink">Observaciones</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-kredo-line bg-white px-3 py-3 text-base outline-none focus:border-kredo-primary"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>

        <div className="rounded-lg border border-kredo-line bg-kredo-surface p-4">
          <h2 className="font-semibold">Vista previa</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-kredo-muted">Saldo actual</dt>
              <dd className="font-semibold">{formatMoney(totalBalanceCents)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-kredo-muted">Aplicado a interes</dt>
              <dd className="font-semibold">{formatMoney(preview.interestAmountCents)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-kredo-muted">Aplicado a capital</dt>
              <dd className="font-semibold">{formatMoney(preview.principalAmountCents)}</dd>
            </div>
            {preview.unappliedAmountCents > 0 ? (
              <div className="flex justify-between gap-3 text-kredo-red">
                <dt>Excedente</dt>
                <dd className="font-semibold">{formatMoney(preview.unappliedAmountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-kredo-muted">Saldo restante</dt>
              <dd className="font-semibold">{formatMoney(preview.remainingBalanceCents)}</dd>
            </div>
          </dl>
        </div>

        {preview.isOverpayment ? (
          <label className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
            <input
              checked={overpaymentConfirmed}
              className="mt-1"
              onChange={(event) => setOverpaymentConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span className="font-medium text-kredo-red">
              Confirmo que el pago supera el saldo pendiente y deseo registrar el excedente.
            </span>
          </label>
        ) : null}

        {formError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">{formError}</p>
        ) : null}

        {isReviewing ? (
          <div className="rounded-lg border border-kredo-line bg-kredo-surface p-4">
            <h2 className="font-semibold">Confirmar pago</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-kredo-muted">Cliente</dt>
                <dd className="text-right font-semibold">{selectedClient?.full_name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-kredo-muted">Monto recibido</dt>
                <dd className="font-semibold">{formatMoney(totalAmountCents)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-kredo-muted">Metodo</dt>
                <dd className="font-semibold">{paymentMethods.find((method) => method.value === paymentMethod)?.label}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <button
          className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={mutation.isPending}
          type="submit"
        >
          Revisar pago
        </button>

        {isReviewing ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              className="min-h-12 rounded-md border border-kredo-line bg-white px-4 py-3 font-semibold"
              disabled={mutation.isPending}
              onClick={() => setIsReviewing(false)}
              type="button"
            >
              Editar
            </button>
            <button
              className="min-h-12 rounded-md bg-kredo-green px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={mutation.isPending}
              onClick={handleConfirm}
              type="button"
            >
              {mutation.isPending ? "Guardando..." : "Confirmar"}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
