import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LockKeyhole, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { useAuth } from "@/features/auth/AuthProvider";

export function LoginPage() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
      setError("Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar sesion.");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("No se pudo iniciar sesion. Revisa el correo y la contrasena.");
    }

    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-kredo-surface px-5 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-between">
        <div className="pt-8">
          <div className="mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kredo-primary">Kredo</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-kredo-ink">Tu cartera en segundos.</h1>
            <p className="mt-3 text-base leading-6 text-kredo-muted">
              Administra clientes, prestamos, pagos y ciclos desde el celular.
            </p>
          </div>

          <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-5 shadow-soft" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-kredo-ink">Correo</span>
              <span className="mt-2 flex items-center gap-3 rounded-md border border-kredo-line bg-white px-3 py-3 focus-within:border-kredo-primary">
                <Mail className="h-5 w-5 text-kredo-muted" aria-hidden="true" />
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
                  autoComplete="email"
                  inputMode="email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@kredo.com"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-kredo-ink">Contrasena</span>
              <span className="mt-2 flex items-center gap-3 rounded-md border border-kredo-line bg-white px-3 py-3 focus-within:border-kredo-primary">
                <LockKeyhole className="h-5 w-5 text-kredo-muted" aria-hidden="true" />
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
                  autoComplete="current-password"
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                />
              </span>
            </label>

            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-kredo-red">{error}</p>
            ) : null}

            <button
              className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Ingresando..." : "Iniciar sesion"}
            </button>
          </form>
        </div>

        <p className="pb-4 pt-8 text-center text-xs text-kredo-muted">
          Las credenciales se configuran en Supabase. No se guardan secretos en el codigo.
        </p>
      </section>
    </main>
  );
}
