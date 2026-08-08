import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { useAuth } from "@/features/auth/AuthProvider";
import { getUserSettings, updateUserSettings } from "@/services/settings.service";

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [businessName, setBusinessName] = useState("");
  const [interestRate, setInterestRate] = useState("10");
  const [message, setMessage] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: () => getUserSettings(user!.id),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setBusinessName(settingsQuery.data.business_name);
    setInterestRate(String(settingsQuery.data.default_interest_rate_bps / 100));
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: () => updateUserSettings(user!.id, {
      business_name: businessName,
      currency: "USD",
      default_interest_rate_bps: Math.round(Number(interestRate) * 100),
      payment_application_rule: "interest_first",
      capitalize_interest: false,
    }),
    onSuccess: (settings) => {
      queryClient.setQueryData(["user-settings", user?.id], settings);
      setMessage("Configuracion guardada correctamente.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuracion."),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!businessName.trim()) return setMessage("Escribe el nombre del negocio.");
    if (!Number.isFinite(Number(interestRate)) || Number(interestRate) < 0 || Number(interestRate) > 100) {
      return setMessage("La tasa debe estar entre 0% y 100%.");
    }
    mutation.mutate();
  }

  return (
    <section>
      <PageHeader eyebrow="Configuracion" title="Configuracion" description="Valores usados para nuevos prestamos y reglas de Kredo." />

      {settingsQuery.isLoading ? <p className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando configuracion...</p> : null}
      {settingsQuery.error ? <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-kredo-red">No se pudo cargar la configuracion.</p> : null}

      {!settingsQuery.isLoading && !settingsQuery.error ? (
        <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-4" onSubmit={handleSubmit}>
          <Field label="Nombre del negocio" onChange={(event) => setBusinessName(event.target.value)} value={businessName} />
          <SelectField disabled label="Moneda" value="USD"><option value="USD">USD</option></SelectField>
          <Field
            inputMode="decimal"
            label="Interes predeterminado (%)"
            max="100"
            min="0"
            onChange={(event) => setInterestRate(event.target.value)}
            step="0.01"
            type="number"
            value={interestRate}
          />
          <SelectField disabled label="Regla de pagos" value="interest_first">
            <option value="interest_first">Interes primero, capital despues</option>
          </SelectField>
          <SelectField disabled label="Capitalizacion de intereses" value="false">
            <option value="false">Desactivada</option>
          </SelectField>
          {message ? <p className={`rounded-md px-3 py-2 text-sm font-medium ${mutation.isError ? "bg-red-50 text-kredo-red" : "bg-green-50 text-kredo-green"}`}>{message}</p> : null}
          <button className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Guardando..." : "Guardar configuracion"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
