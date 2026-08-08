import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { getOrCreateActiveOrganization, type Organization } from "@/services/organizations.service";

type OrganizationContextValue = {
  organization: Organization | null;
  organizationId: string | null;
  loading: boolean;
  error: Error | null;
};

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!user) {
      setOrganization(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    getOrCreateActiveOrganization(user)
      .then((nextOrganization) => {
        if (!mounted) return;
        setOrganization(nextOrganization);
      })
      .catch((nextError) => {
        if (!mounted) return;
        setError(nextError instanceof Error ? nextError : new Error("No se pudo cargar la empresa activa."));
        setOrganization(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organization,
      organizationId: organization?.id ?? null,
      loading,
      error,
    }),
    [error, loading, organization],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const value = useContext(OrganizationContext);

  if (!value) {
    throw new Error("useOrganization must be used inside OrganizationProvider");
  }

  return value;
}
