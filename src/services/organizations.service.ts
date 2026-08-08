import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type OrganizationRole = "owner" | "admin" | "operator" | "viewer";

export type Organization = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type OrganizationMembership = {
  organization_id: string;
  role: OrganizationRole;
  organizations: Organization | null;
};

function getDefaultBusinessName(user: User) {
  const businessName = user.user_metadata?.business_name;
  const fullName = user.user_metadata?.full_name;

  if (typeof businessName === "string" && businessName.trim()) {
    return businessName.trim();
  }

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  return "Kredo";
}

export async function listUserOrganizations(): Promise<Organization[]> {
  const { data, error } = await (supabase as any)
    .from("organization_members")
    .select("organization_id, role, organizations(*)")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as OrganizationMembership[])
    .map((membership) => membership.organizations)
    .filter((organization): organization is Organization => Boolean(organization));
}

export async function createDefaultOrganization(user: User): Promise<Organization> {
  const { data: organization, error: organizationError } = await (supabase as any)
    .from("organizations")
    .insert({
      owner_id: user.id,
      name: getDefaultBusinessName(user),
    })
    .select("*")
    .single();

  if (organizationError) {
    throw organizationError;
  }

  const { error: membershipError } = await (supabase as any)
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: user.id,
      role: "owner",
    });

  if (membershipError) {
    throw membershipError;
  }

  await (supabase as any)
    .from("user_settings")
    .insert({
      user_id: user.id,
      organization_id: organization.id,
      business_name: organization.name,
    })
    .select("*")
    .maybeSingle();

  return organization as Organization;
}

export async function getOrCreateActiveOrganization(user: User): Promise<Organization> {
  const organizations = await listUserOrganizations();

  if (organizations[0]) {
    return organizations[0];
  }

  return createDefaultOrganization(user);
}
