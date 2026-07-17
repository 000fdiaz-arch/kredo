import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { listClientsWithBalances } from "@/services/clients.service";
import { useAuth } from "@/features/auth/AuthProvider";
import { createLoan } from "@/services/loans.service";
import { formatMoney } from "@/lib/money";
import { getCycleRange, toDateInputValue } from "@/lib/dates";

export function LoanFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [clientId, setClientId] = useState(searchParams.get("clientId") ?? "");
  const [loanDate, setLoanDate] = useState(toDateInputValue());
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("10");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listClientsWithBalances,
  });

  const selectedClient = clients.find((client) => client.id === clientId);
  const amountCents = Math.round(Number(amount || "0") * 100);
  const interestRateBps = Math.round(Number(interestRate || "0") * 100);
  const cycleRange = useMemo(() => getCycleRange(loanDate), [loanDate]);

  const mutation = useMutation({
    mutationFn: createLoan,
    onSuccess: async (loan) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["client", loan.client_id] });
      navigate(`/receipts/loan/${loan.id}`);
    },
    onError: () => {
      setFormError("No se pudo registrar el prestamo. Revisa la conexion y que la migracion este aplicada.");
      setIsReviewing(false);
    },
  });

  function validateForm() {
    if (!user) {
      return "Debes iniciar sesion para registrar prestamos.";
    }

    if (!clientId) {
      return "Selecciona un cliente.";
    }

    if (!loanDate) {
      return "Selecciona la fecha del prestamo.";
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return "El monto prestado debe ser mayor que cero.";
    }

    if (!Number.isFinite(interestRateBps) || interestRateBps < 0) {
      return "El interes no puede ser negativo.";
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
      loanDate,
      amountCents,
      interestRateBps,
      notes,
    });
  }

  return (
    <section>
      <PageHeader
        eyebrow="Nuevo prestamo"
        title="Registrar prestamo"
        description="Revisa el resumen antes de guardar el movimiento en Supabase."
      />

      <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-4" onSubmit={handleReview}>
        <SelectField label="Cliente" value={clientId} onChange={(event) => setClientId(event.target.value)}>
          <option value="">{isLoading ? "Cargando clientes..." : "Seleccionar cliente"}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.full_name}
            </option>
          ))}
        </SelectField>
        <Field label="Fecha" type="date" value={loanDate} onChange={(event) => setLoanDate(event.target.value)} />
        <Field
          inputMode="decimal"
          label="Monto prestado"
          min="0"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          step="0.01"
          type="number"
          value={amount}
        />
        <Field
          inputMode="decimal"
          label="Interes (%)"
          min="0"
          onChange={(event) => setInterestRate(event.target.value)}
          placeholder="10"
          step="0.01"
          type="number"
          value={interestRate}
        />
        <SelectField label="Ciclo inicial">
          <option>
            {cycleRange.startDate} al {cycleRange.endDate}
          </option>
        </SelectField>
        <label className="block">
          <span className="text-sm font-medium text-kredo-ink">Observaciones</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-kredo-line bg-white px-3 py-3 text-base outline-none focus:border-kredo-primary"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>

        {formError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">{formError}</p>
        ) : null}

        {isReviewing ? (
          <div className="rounded-lg border border-kredo-line bg-kredo-surface p-4">
            <h2 className="font-semibold">Confirmar prestamo</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-kredo-muted">Cliente</dt>
                <dd className="text-right font-semibold">{selectedClient?.full_name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-kredo-muted">Monto</dt>
                <dd className="font-semibold">{formatMoney(amountCents)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-kredo-muted">Interes</dt>
                <dd className="font-semibold">{Number(interestRate).toFixed(2)}%</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-kredo-muted">Ciclo</dt>
                <dd className="text-right font-semibold">
                  {cycleRange.startDate} al {cycleRange.endDate}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        <button className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white" type="submit">
          Revisar prestamo
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
