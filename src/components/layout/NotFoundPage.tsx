import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-kredo-surface px-5">
      <section className="w-full max-w-sm rounded-lg border border-kredo-line bg-white p-6 text-center shadow-soft">
        <p className="text-sm font-semibold text-kredo-muted">404</p>
        <h1 className="mt-2 text-2xl font-bold text-kredo-ink">Pantalla no encontrada</h1>
        <Link className="mt-5 inline-flex rounded-md bg-kredo-primary px-4 py-3 font-semibold text-white" to="/dashboard">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
