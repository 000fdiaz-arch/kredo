import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientBalanceRow = Database["public"]["Views"]["client_balances"]["Row"];

export type ClientWithBalance = ClientRow & {
  balance: ClientBalanceRow | null;
};

export type CreateClientInput = {
  userId: string;
  fullName: string;
  identification?: string;
  phone?: string;
  address?: string;
  referenceName?: string;
  referencePhone?: string;
  notes?: string;
};

export type UpdateClientInput = CreateClientInput & {
  clientId: string;
};

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function createClientCode() {
  const now = new Date();
  const datePart = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");

  return `CLI-${datePart}-${timePart}`;
}

export async function createClient(input: CreateClientInput): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: input.userId,
      client_code: createClientCode(),
      full_name: input.fullName.trim(),
      identification: normalizeOptional(input.identification),
      phone: normalizeOptional(input.phone),
      address: normalizeOptional(input.address),
      reference_name: normalizeOptional(input.referenceName),
      reference_phone: normalizeOptional(input.referencePhone),
      notes: normalizeOptional(input.notes),
      status: "no_movements",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateClient(input: UpdateClientInput): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clients")
    .update({
      full_name: input.fullName.trim(),
      identification: normalizeOptional(input.identification),
      phone: normalizeOptional(input.phone),
      address: normalizeOptional(input.address),
      reference_name: normalizeOptional(input.referenceName),
      reference_phone: normalizeOptional(input.referencePhone),
      notes: normalizeOptional(input.notes),
    })
    .eq("id", input.clientId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listClientsWithBalances(): Promise<ClientWithBalance[]> {
  const [{ data: clients, error: clientsError }, { data: balances, error: balancesError }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name", { ascending: true }),
    supabase.from("client_balances").select("*"),
  ]);

  if (clientsError) {
    throw clientsError;
  }

  if (balancesError) {
    throw balancesError;
  }

  const balancesByClient = new Map((balances ?? []).map((balance) => [balance.client_id, balance]));

  return (clients ?? []).map((client) => ({
    ...client,
    balance: balancesByClient.get(client.id) ?? null,
  }));
}

export async function getClientWithBalance(clientId: string): Promise<ClientWithBalance | null> {
  const [{ data: client, error: clientError }, { data: balance, error: balanceError }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    supabase.from("client_balances").select("*").eq("client_id", clientId).maybeSingle(),
  ]);

  if (clientError) {
    throw clientError;
  }

  if (balanceError) {
    throw balanceError;
  }

  if (!client) {
    return null;
  }

  return {
    ...client,
    balance,
  };
}
