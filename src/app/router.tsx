import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { NotFoundPage } from "@/components/layout/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    hydrateFallbackElement: <LoadingScreen />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", lazy: async () => ({ Component: (await import("@/features/dashboard/DashboardPage")).DashboardPage }) },
          { path: "/clients", lazy: async () => ({ Component: (await import("@/features/clients/ClientsPage")).ClientsPage }) },
          { path: "/clients/new", lazy: async () => ({ Component: (await import("@/features/clients/ClientFormPage")).ClientFormPage }) },
          { path: "/clients/:clientId", lazy: async () => ({ Component: (await import("@/features/clients/ClientProfilePage")).ClientProfilePage }) },
          { path: "/clients/:clientId/edit", lazy: async () => ({ Component: (await import("@/features/clients/ClientFormPage")).ClientFormPage }) },
          { path: "/loans/new", lazy: async () => ({ Component: (await import("@/features/loans/LoanFormPage")).LoanFormPage }) },
          { path: "/payments/new", lazy: async () => ({ Component: (await import("@/features/payments/PaymentFormPage")).PaymentFormPage }) },
          { path: "/cycles/payments", lazy: async () => ({ Component: (await import("@/features/cycles/CyclePaymentsPage")).CyclePaymentsPage }) },
          { path: "/cycles", lazy: async () => ({ Component: (await import("@/features/cycles/CyclesPage")).CyclesPage }) },
          { path: "/history", lazy: async () => ({ Component: (await import("@/features/history/HistoryPage")).HistoryPage }) },
          { path: "/reports", lazy: async () => ({ Component: (await import("@/features/reports/ReportsPage")).ReportsPage }) },
          { path: "/settings", lazy: async () => ({ Component: (await import("@/features/settings/SettingsPage")).SettingsPage }) },
          { path: "/receipts/:receiptType/:receiptId", lazy: async () => ({ Component: (await import("@/features/receipts/ReceiptPage")).ReceiptPage }) },
          { path: "/clients/:clientId/statement", lazy: async () => ({ Component: (await import("@/features/statements/ClientStatementPage")).ClientStatementPage }) },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
