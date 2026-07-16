import { LogOut, Menu, Users, WalletCards, ReceiptText, BarChart3, MoreHorizontal } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { clsx } from "clsx";
import { useAuth } from "@/features/auth/AuthProvider";

const primaryNavItems = [
  { label: "Inicio", to: "/dashboard", icon: BarChart3 },
  { label: "Clientes", to: "/clients", icon: Users },
  { label: "Prestamo", to: "/loans/new", icon: WalletCards },
  { label: "Pago", to: "/payments/new", icon: ReceiptText },
  { label: "Mas", to: "/reports", icon: MoreHorizontal },
];

export function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-kredo-surface text-kredo-ink">
      <header className="sticky top-0 z-20 border-b border-kredo-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kredo-primary">Kredo</p>
            <p className="max-w-[220px] truncate text-sm text-kredo-muted">{user?.email ?? "Administrador"}</p>
          </div>
          <div className="flex items-center gap-2">
            <NavLink
              aria-label="Ver mas opciones"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-kredo-line bg-white text-kredo-ink"
              to="/settings"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </NavLink>
            <button
              aria-label="Cerrar sesion"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-kredo-line bg-white text-kredo-ink"
              onClick={() => void signOut()}
              type="button"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-kredo-line bg-white px-2 pt-2 shadow-[0_-10px_30px_rgba(23,32,51,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {primaryNavItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                clsx(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold",
                  isActive ? "bg-blue-50 text-kredo-primary" : "text-kredo-muted",
                )
              }
              key={item.to}
              to={item.to}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
