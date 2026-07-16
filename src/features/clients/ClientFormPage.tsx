import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  createClient,
  getClientWithBalance,
  updateClient,
  type CreateClientInput,
  type UpdateClientInput,
} from "@/services/clients.service";

export function ClientFormPage() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEditing = Boolean(clientId);
  const [fullName, setFullName] = useState("");
  const [identification, setIdentification] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [referencePhone, setReferencePhone] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const {
    data: existingClient,
    isLoading: existingClientLoading,
    error: existingClientError,
  } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientWithBalance(clientId ?? ""),
    enabled: isEditing,
  });

  useEffect(() => {
    if (!existingClient) {
      return;
    }

    setFullName(existingClient.full_name);
    setIdentification(existingClient.identification ?? "");
    setPhone(existingClient.phone ?? "");
    setAddress(existingClient.address ?? "");
    setReferenceName(existingClient.reference_name ?? "");
    setReferencePhone(existingClient.reference_phone ?? "");
    setNotes(existingClient.notes ?? "");
  }, [existingClient]);

  const mutation = useMutation({
    mutationFn: (input: CreateClientInput | UpdateClientInput) => ("clientId" in input ? updateClient(input) : createClient(input)),
    onSuccess: async (client) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["client", client.id] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      navigate(`/clients/${client.id}`);
    },
    onError: () => {
      setFormError(isEditing ? "No se pudo actualizar el cliente. Revisa la conexion e intenta otra vez." : "No se pudo crear el cliente. Revisa la conexion y que la migracion este aplicada.");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!user) {
      setFormError(isEditing ? "Debes iniciar sesion para editar clientes." : "Debes iniciar sesion para crear clientes.");
      return;
    }

    if (!fullName.trim()) {
      setFormError("El nombre completo es obligatorio.");
      return;
    }

    const input = {
      userId: user.id,
      fullName,
      identification,
      phone,
      address,
      referenceName,
      referencePhone,
      notes,
    };

    if (isEditing) {
      mutation.mutate({
        ...input,
        clientId: clientId ?? "",
      });
      return;
    }

    mutation.mutate(input);
  }

  if (existingClientLoading) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cargando cliente...</article>;
  }

  if (existingClientError) {
    return <article className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-kredo-red">No se pudo cargar el cliente.</article>;
  }

  if (isEditing && !existingClient) {
    return <article className="rounded-lg border border-kredo-line bg-white p-4 text-sm text-kredo-muted">Cliente no encontrado.</article>;
  }

  return (
    <section>
      <PageHeader
        eyebrow="Clientes"
        title={isEditing ? "Editar perfil" : "Crear cliente"}
        description={isEditing ? undefined : "Registra los datos basicos. Los saldos se calcularan solo desde movimientos."}
      />

      <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-4" onSubmit={handleSubmit}>
        <Field
          label="Nombre completo"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Nombre y apellido"
        />
        <Field
          label="Cedula"
          value={identification}
          onChange={(event) => setIdentification(event.target.value)}
          placeholder="Opcional"
        />
        <Field
          inputMode="tel"
          label="Telefono"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Opcional"
          type="tel"
        />
        <Field
          label="Direccion"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Opcional"
        />
        <Field
          label="Contacto de referencia"
          value={referenceName}
          onChange={(event) => setReferenceName(event.target.value)}
          placeholder="Opcional"
        />
        <Field
          inputMode="tel"
          label="Telefono de referencia"
          value={referencePhone}
          onChange={(event) => setReferencePhone(event.target.value)}
          placeholder="Opcional"
          type="tel"
        />
        <label className="block">
          <span className="text-sm font-medium text-kredo-ink">Notas</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-kredo-line bg-white px-3 py-3 text-base outline-none focus:border-kredo-primary"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opcional"
          />
        </label>

        {formError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">{formError}</p>
        ) : null}

        <button
          className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear cliente"}
        </button>
      </form>
    </section>
  );
}
