import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type TagRow = Database["public"]["Tables"]["tags"]["Row"];

function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function listTags(): Promise<TagRow[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function findTagByName(organizationId: string, name: string): Promise<TagRow | null> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) throw error;

  const normalizedName = normalizeTagName(name).toLocaleLowerCase();
  return (data ?? []).find((tag) => tag.name.toLocaleLowerCase() === normalizedName) ?? null;
}

export async function createTag(input: {
  organizationId: string;
  userId: string;
  name: string;
}): Promise<TagRow> {
  const name = normalizeTagName(input.name);
  if (!name || name.length > 40) throw new Error("Invalid tag name");

  const existing = await findTagByName(input.organizationId, name);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("tags")
    .insert({
      organization_id: input.organizationId,
      created_by: input.userId,
      name,
    })
    .select("*")
    .single();

  if (!error) return data;

  if (error.code === "23505") {
    const concurrentTag = await findTagByName(input.organizationId, name);
    if (concurrentTag) return concurrentTag;
  }

  throw error;
}

export async function replaceClientTags(input: {
  clientId: string;
  organizationId: string;
  tagIds: string[];
}) {
  const { error: deleteError } = await supabase
    .from("client_tags")
    .delete()
    .eq("client_id", input.clientId)
    .eq("organization_id", input.organizationId);

  if (deleteError) throw deleteError;

  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.length === 0) return;

  const { error: insertError } = await supabase.from("client_tags").insert(
    tagIds.map((tagId) => ({
      client_id: input.clientId,
      organization_id: input.organizationId,
      tag_id: tagId,
    })),
  );

  if (insertError) throw insertError;
}

export async function addClientTag(input: {
  clientId: string;
  organizationId: string;
  tagId: string;
}) {
  const { error } = await supabase.from("client_tags").insert({
    client_id: input.clientId,
    organization_id: input.organizationId,
    tag_id: input.tagId,
  });

  if (error && error.code !== "23505") throw error;
}

export async function removeClientTag(input: {
  clientId: string;
  organizationId: string;
  tagId: string;
}) {
  const { error } = await supabase
    .from("client_tags")
    .delete()
    .eq("client_id", input.clientId)
    .eq("organization_id", input.organizationId)
    .eq("tag_id", input.tagId);

  if (error) throw error;
}
