import { Navigate, Outlet } from "react-router-dom";
import { useCurrentUser } from "@/auth/user";

export default function ProtectedRoute() {
  const { user, loading } = useCurrentUser();
  if (loading) return <div className="center-screen">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
