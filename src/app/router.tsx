import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ClientsPage } from "@/features/clients/ClientsPage";
import { ClientProfilePage } from "@/features/clients/ClientProfilePage";
import { ClientFormPage } from "@/features/clients/ClientFormPage";
import { LoanFormPage } from "@/features/loans/LoanFormPage";
import { PaymentFormPage } from "@/features/payments/PaymentFormPage";
import { CyclesPage } from "@/features/cycles/CyclesPage";
import { HistoryPage } from "@/features/history/HistoryPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { NotFoundPage } from "@/components/layout/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/clients", element: <ClientsPage /> },
          { path: "/clients/new", element: <ClientFormPage /> },
          { path: "/clients/:clientId", element: <ClientProfilePage /> },
          { path: "/loans/new", element: <LoanFormPage /> },
          { path: "/payments/new", element: <PaymentFormPage /> },
          { path: "/cycles", element: <CyclesPage /> },
          { path: "/history", element: <HistoryPage /> },
          { path: "/reports", element: <ReportsPage /> },
          { path: "/settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
