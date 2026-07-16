import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { useAuth } from "@/features/auth/AuthProvider";

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
