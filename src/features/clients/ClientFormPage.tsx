import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Tag, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrganization } from "@/features/organizations/OrganizationProvider";
import {
  createClient,
  getClientWithBalance,
  updateClient,
  type CreateClientInput,
  type UpdateClientInput,
} from "@/services/clients.service";
import { createTag, listTags, replaceClientTags } from "@/services/tags.service";

export function ClientFormPage() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organizationId, loading: organizationLoading } = useOrganization();
  const isEditing = Boolean(clientId);
  const [fullName, setFullName] = useState("");
  const [identification, setIdentification] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [referencePhone, setReferencePhone] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagNames, setNewTagNames] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [formError, setFormError] = useState("");

  const { data: availableTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: listTags,
  });

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
    setSelectedTagIds(existingClient.tags.map((tag) => tag.id));
  }, [existingClient]);

  const mutation = useMutation({
    mutationFn: async (input: CreateClientInput | UpdateClientInput) => {
      const createdTags = await Promise.all(
        newTagNames.map((name) => createTag({
          organizationId: input.organizationId,
          userId: input.userId,
          name,
        })),
      );
      const client = "clientId" in input ? await updateClient(input) : await createClient(input);

      await replaceClientTags({
        clientId: client.id,
        organizationId: input.organizationId,
        tagIds: [...selectedTagIds, ...createdTags.map((tag) => tag.id)],
      });

      return client;
    },
    onSuccess: async (client) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["client", client.id] }),
        queryClient.invalidateQueries({ queryKey: ["tags"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      navigate(`/clients/${client.id}`);
    },
    onError: () => {
      setFormError(isEditing ? "No se pudo actualizar el cliente. Revisa la conexion e intenta otra vez." : "No se pudo crear el cliente. Revisa la conexion y que la migracion este aplicada.");
    },
  });

  function addNewTag() {
    const name = tagInput.trim().replace(/\s+/g, " ");
    if (!name) return;

    if (name.length > 40) {
      setFormError("Las etiquetas pueden tener hasta 40 caracteres.");
      return;
    }

    const existing = availableTags.find((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) {
      setSelectedTagIds((current) => current.includes(existing.id) ? current : [...current, existing.id]);
    } else if (!newTagNames.some((tagName) => tagName.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setNewTagNames((current) => [...current, name]);
    }

    setTagInput("");
    setFormError("");
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addNewTag();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!user || !organizationId) {
      setFormError(isEditing ? "Debes iniciar sesion para editar clientes." : "Debes iniciar sesion para crear clientes.");
      return;
    }

    if (!fullName.trim()) {
      setFormError("El nombre completo es obligatorio.");
      return;
    }

    const input = {
      userId: user.id,
      organizationId,
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

        <fieldset>
          <legend className="flex items-center gap-2 text-sm font-medium text-kredo-ink">
            <Tag className="h-4 w-4" aria-hidden="true" />
            Etiquetas
          </legend>
          <p className="mt-1 text-xs text-kredo-muted">Un cliente puede pertenecer a varias etiquetas.</p>

          {availableTags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    aria-pressed={selected}
                    className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${
                      selected
                        ? "border-kredo-primary bg-blue-50 text-kredo-primary"
                        : "border-kredo-line bg-white text-kredo-muted"
                    }`}
                    key={tag.id}
                    onClick={() => setSelectedTagIds((current) => (
                      selected ? current.filter((tagId) => tagId !== tag.id) : [...current, tag.id]
                    ))}
                    type="button"
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          {newTagNames.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {newTagNames.map((name) => (
                <span className="inline-flex min-h-10 items-center gap-1 rounded-full border border-kredo-green bg-green-50 px-3 text-sm font-semibold text-kredo-green" key={name}>
                  {name}
                  <button
                    aria-label={`Quitar etiqueta ${name}`}
                    className="rounded-full p-1"
                    onClick={() => setNewTagNames((current) => current.filter((tagName) => tagName !== name))}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex gap-2">
            <input
              className="min-h-12 min-w-0 flex-1 rounded-md border border-kredo-line bg-white px-3 text-base outline-none focus:border-kredo-primary"
              maxLength={40}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Nueva etiqueta"
              value={tagInput}
            />
            <button
              aria-label="Agregar etiqueta"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-kredo-line bg-white px-4 font-semibold text-kredo-primary disabled:opacity-50"
              disabled={!tagInput.trim()}
              onClick={addNewTag}
              type="button"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </fieldset>

        {formError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">{formError}</p>
        ) : null}

        <button
          className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={mutation.isPending || organizationLoading}
          type="submit"
        >
          {mutation.isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear cliente"}
        </button>
      </form>
    </section>
  );
}
