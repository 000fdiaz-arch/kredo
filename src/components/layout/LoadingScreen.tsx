export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-kredo-surface px-6">
      <div className="w-full max-w-xs rounded-lg border border-kredo-line bg-white p-5 text-center shadow-soft">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-kredo-line border-t-kredo-primary" />
        <p className="text-sm font-medium text-kredo-ink">Preparando Kredo...</p>
      </div>
    </main>
  );
}
