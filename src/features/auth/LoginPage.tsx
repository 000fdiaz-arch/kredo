import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Building2, CheckCircle2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { useAuth } from "@/features/auth/AuthProvider";

type AuthMode = "sign-in" | "sign-up";

export function LoginPage() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";
  const isSignUp = mode === "sign-up";

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!isSupabaseConfigured) {
      setError("Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar sesion.");
      return;
    }

    if (isSignUp && !businessName.trim()) {
      setError("Escribe el nombre de tu negocio.");
      return;
    }

    if (isSignUp && password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    setSubmitting(true);

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            business_name: businessName.trim(),
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        setError("No se pudo crear la cuenta. Revisa los datos e intenta otra vez.");
      } else {
        setNotice("Cuenta creada. Revisa tu correo para confirmar el acceso antes de iniciar sesion.");
        setMode("sign-in");
        setPassword("");
      }

      setSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("No se pudo iniciar sesion. Revisa el correo y la contrasena.");
    }

    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-kredo-surface px-5 py-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl content-center gap-8 lg:grid-cols-[1fr_440px] lg:items-center">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kredo-primary">Kredo</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-kredo-ink sm:text-5xl">
            Controla prestamos, pagos y cartera desde un solo lugar.
          </h1>
          <p className="mt-4 text-base leading-7 text-kredo-muted">
            Para financieras, prestamistas y negocios que necesitan saber quien debe, cuanto pago y que intereses vencen.
          </p>

          <div className="mt-7 grid gap-3 text-sm text-kredo-ink sm:grid-cols-3">
            {[
              { title: "Clientes", helper: "Historial y saldos claros." },
              { title: "Prestamos", helper: "Desembolsos, ciclos e intereses." },
              { title: "Pagos", helper: "Recibos y abonos al dia." },
            ].map((item) => (
              <div className="flex items-start gap-2 rounded-md border border-kredo-line bg-white px-3 py-3" key={item.title}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-kredo-green" aria-hidden="true" />
                <span className="leading-5">
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-kredo-muted">{item.helper}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <form className="space-y-4 rounded-lg border border-kredo-line bg-white p-5 shadow-soft" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 rounded-md bg-kredo-surface p-1">
              <button
                className={`min-h-10 rounded px-3 text-sm font-semibold ${!isSignUp ? "bg-white text-kredo-ink shadow-sm" : "text-kredo-muted"}`}
                onClick={() => switchMode("sign-in")}
                type="button"
              >
                Iniciar sesion
              </button>
              <button
                className={`min-h-10 rounded px-3 text-sm font-semibold ${isSignUp ? "bg-white text-kredo-ink shadow-sm" : "text-kredo-muted"}`}
                onClick={() => switchMode("sign-up")}
                type="button"
              >
                Crear cuenta
              </button>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-kredo-ink">{isSignUp ? "Registra tu negocio" : "Entra a tu cartera"}</h2>
              <p className="mt-1 text-sm leading-5 text-kredo-muted">
                {isSignUp ? "Crea tu acceso y empieza con una empresa separada." : "Accede a los clientes y movimientos de tu empresa."}
              </p>
            </div>

            {isSignUp ? (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-kredo-ink">Nombre del negocio</span>
                  <span className="mt-2 flex items-center gap-3 rounded-md border border-kredo-line bg-white px-3 py-3 focus-within:border-kredo-primary">
                    <Building2 className="h-5 w-5 text-kredo-muted" aria-hidden="true" />
                    <input
                      className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
                      autoComplete="organization"
                      required
                      type="text"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      placeholder="Financiera Lopez"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-kredo-ink">Tu nombre</span>
                  <span className="mt-2 flex items-center gap-3 rounded-md border border-kredo-line bg-white px-3 py-3 focus-within:border-kredo-primary">
                    <UserRound className="h-5 w-5 text-kredo-muted" aria-hidden="true" />
                    <input
                      className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
                      autoComplete="name"
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Nombre y apellido"
                    />
                  </span>
                </label>
              </>
            ) : null}

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

            {notice ? (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-kredo-green">{notice}</p>
            ) : null}

            <button
              className="min-h-12 w-full rounded-md bg-kredo-primary px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? (isSignUp ? "Creando cuenta..." : "Ingresando...") : isSignUp ? "Crear mi cuenta" : "Iniciar sesion"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
